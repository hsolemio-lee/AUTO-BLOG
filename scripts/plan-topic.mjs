import fs from "node:fs/promises";
import yaml from "js-yaml";

import { ensureDir, fileExists, readJson, writeJson } from "./lib/io.mjs";
import { generateStructuredJson, hasOpenAiKey } from "./lib/openai.mjs";
import {
  CONTENT_DIR,
  SOURCES_CONFIG_FILE,
  STATE_DIR,
  TOPIC_FILE
} from "./lib/paths.mjs";
import { readPromptTemplate } from "./lib/prompts.mjs";
import { jaccardSimilarity } from "./lib/text.mjs";
import { fetchTrendEntries } from "./lib/trends.mjs";

const FOCUS_KEYWORDS = [
  "ai",
  "llm",
  "model",
  "spring",
  "backend",
  "api",
  "cloud",
  "aws",
  "gcp",
  "kubernetes",
  "database",
  "microservice",
  "architecture",
  "system design",
  "msa",
  "saga",
  "outbox",
  "scm",
  "supply chain",
  "logistics",
  "procurement",
  "inventory",
  "warehouse",
  "demand planning",
  "frontend",
  "react",
  "next.js",
  "vue",
  "css",
  "ui",
  "cursor",
  "copilot",
  "claude code",
  "windsurf",
  "agentic",
  "coding agent",
  "code generation",
  "ai coding"
];

const SEARCH_INTENT_KEYWORDS = [
  "가이드",
  "실전",
  "체크리스트",
  "비교",
  "최적화",
  "문제 해결",
  "방법",
  "전략",
  "성능",
  "보안",
  "how to",
  "checklist",
  "guide",
  "vs",
  "troubleshooting"
];

const HIGH_DEMAND_TERMS = [
  "spring boot",
  "spring",
  "kubernetes",
  "aws",
  "gcp",
  "rag",
  "llm",
  "jwt",
  "jpa",
  "api",
  "observability",
  "idempotency",
  "retry",
  "architecture",
  "system design",
  "microservice",
  "event-driven",
  "scm",
  "supply chain",
  "logistics",
  "procurement",
  "inventory",
  "warehouse",
  "demand planning",
  "frontend",
  "react",
  "next.js",
  "typescript",
  "ui",
  "cursor",
  "copilot",
  "claude code",
  "windsurf",
  "agentic",
  "coding agent"
];

async function main() {
  await ensureDir(STATE_DIR);
  const config = await loadSourcesConfig();
  const historyTitles = await loadHistoryTitles();
  const candidates = await loadCandidates(config);

  const scored = candidates
    .map((candidate) => ({
      title: candidate.title,
      category: candidate.category,
      angle: candidate.angle,
      source_type: candidate.source_type,
      ...scoreCandidate(candidate.title, historyTitles, config, candidate.source_type)
    }))
    .sort((a, b) => b.total - a.total);

  const llmDecision = await pickWithOpenAi(scored, historyTitles);
  const selected = findCandidate(scored, llmDecision?.selected_topic?.title) ?? scored[0];
  const fallback =
    findCandidate(scored, llmDecision?.fallback_topic?.title) ??
    scored.find((item) => item.title !== selected.title) ??
    scored[0];

  const output = {
    date: new Date().toISOString(),
    selected_topic: {
      title: selected.title,
      angle: llmDecision?.selected_topic?.angle ?? selected.angle,
      score: selected.total,
      ...(selected.source_url && { source_url: selected.source_url }),
      ...(selected.published_at && { published_at: selected.published_at }),
      ...(selected.source && { source_name: selected.source })
    },
    fallback_topic: {
      title: fallback.title,
      angle: llmDecision?.fallback_topic?.angle ?? fallback.angle,
      score: fallback.total,
      ...(fallback.source_url && { source_url: fallback.source_url }),
      ...(fallback.published_at && { published_at: fallback.published_at })
    },
    candidates: scored.slice(0, 8).map((item) => ({
      ...item,
      reason:
        llmDecision?.candidates?.find((candidate) => candidate.title === item.title)?.reason ??
        item.reason
    }))
  };

  await writeJson(TOPIC_FILE, output);
  console.log(`Topic selected: ${selected.title}`);
}

async function loadSourcesConfig() {
  const raw = await fs.readFile(SOURCES_CONFIG_FILE, "utf8");
  return yaml.load(raw);
}

async function loadHistoryTitles() {
  const titles = [];
  if (!(await fileExists(CONTENT_DIR))) {
    return titles;
  }

  const entries = await fs.readdir(CONTENT_DIR);
  for (const fileName of entries) {
    if (!fileName.endsWith(".md") && !fileName.endsWith(".mdx")) {
      continue;
    }
    const fullPath = `${CONTENT_DIR}/${fileName}`;
    const content = await fs.readFile(fullPath, "utf8");
    const match = content.match(/title:\s*"([^"]+)"/);
    if (match) {
      titles.push(match[1]);
    }
  }

  if (titles.length === 0 && (await fileExists(TOPIC_FILE))) {
    const oldTopic = await readJson(TOPIC_FILE);
    if (oldTopic?.selected_topic?.title) {
      titles.push(oldTopic.selected_topic.title);
    }
  }

  const excludeFromEnv = process.env.BLOG_EXCLUDE_TITLES
    ? process.env.BLOG_EXCLUDE_TITLES.split("||").map((item) => item.trim()).filter(Boolean)
    : [];
  titles.push(...excludeFromEnv);

  return titles;
}

async function loadCandidates(config) {
  const focusedHn = await fetchFocusedHnTitles();
  const trendEntries = await fetchTrendEntries({ maxPerFeed: 6 });

  const hnEntries = focusedHn.map((entry) => ({
    title: entry.title,
    category: inferCategory(entry.title),
    source_type: "hn",
    source_url: entry.url
  }));

  const trendCandidates = trendEntries
    .filter((entry) => isFocusedTitle(entry.title.toLowerCase()))
    .map((entry) => ({
      title: entry.title,
      category: entry.category,
      source: entry.source,
      source_type: "trend",
      source_url: entry.url,
      published_at: entry.published_at
    }));

  const dynamicCandidates = dedupeCandidates([...trendCandidates, ...hnEntries]);

  if (dynamicCandidates.length === 0) {
    throw new Error("No dynamic candidates available from trend feeds or Hacker News.");
  }

  const minCandidates = config?.topic_selection?.min_candidates ?? 8;
  const maxCandidates = config?.topic_selection?.max_candidates ?? 20;
  if (dynamicCandidates.length < minCandidates) {
    console.warn(`Dynamic candidates below minimum (${dynamicCandidates.length} < ${minCandidates}).`);
  }

  return dynamicCandidates.slice(0, maxCandidates);
}

async function fetchFocusedHnTitles() {
  try {
    const topIdsResponse = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
    if (!topIdsResponse.ok) {
      return [];
    }

    const ids = (await topIdsResponse.json()).slice(0, 30);
    const titles = [];

    await Promise.all(
      ids.map(async (id) => {
        const itemResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        if (!itemResponse.ok) {
          return;
        }
        const item = await itemResponse.json();
        if (item?.title && typeof item.title === "string") {
          const lowered = item.title.toLowerCase();
          if (isFocusedTitle(lowered)) {
            titles.push({ title: item.title, url: item.url ?? "" });
          }
        }
      })
    );

    return titles;
  } catch {
    return [];
  }
}

function scoreCandidate(title, historyTitles, config, sourceType = "pool") {
  const noveltyWeight = config?.topic_selection?.novelty_weight ?? 0.4;
  const utilityWeight = config?.topic_selection?.utility_weight ?? 0.35;
  const trendWeight = config?.topic_selection?.trend_weight ?? 0.25;

  const similarity = Math.max(
    0,
    ...historyTitles.map((oldTitle) => jaccardSimilarity(title, oldTitle))
  );
  const novelty = Math.round((1 - similarity) * 100);
  const utility = scoreUtility(title);
  const trend = scoreTrend(title);
  const search = scoreSearchIntent(title);
  const sourceScore = scoreSourcePriority(sourceType);

  const total = Math.round(
    novelty * noveltyWeight +
      utility * utilityWeight +
      trend * trendWeight +
      search * 0.2 +
      sourceScore * 0.15
  );

  return {
    novelty,
    utility,
    trend,
    search,
    source: sourceType,
    total,
    reason: "Weighted by novelty, practical utility, trend signals, and search intent."
  };
}

function scoreSourcePriority(sourceType) {
  if (sourceType === "trend") {
    return 100;
  }
  if (sourceType === "hn") {
    return 85;
  }
  return 40;
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  const unique = [];

  for (const candidate of candidates) {
    const key = candidate.title.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push({
      ...candidate,
      angle: angleForCategory(candidate.category),
      ...(candidate.source_url && { source_url: candidate.source_url }),
      ...(candidate.published_at && { published_at: candidate.published_at })
    });
  }

  return unique;
}

function inferCategory(title) {
  const lower = title.toLowerCase();

  if (
    lower.includes("frontend") ||
    lower.includes("react") ||
    lower.includes("next.js") ||
    lower.includes("vue") ||
    lower.includes("css") ||
    lower.includes("ui")
  ) {
    return "frontend";
  }
  if (lower.includes("spring")) {
    return "spring_backend";
  }
  if (
    lower.includes("scm") ||
    lower.includes("supply chain") ||
    lower.includes("logistics") ||
    lower.includes("procurement") ||
    lower.includes("inventory") ||
    lower.includes("warehouse") ||
    lower.includes("demand planning")
  ) {
    return "scm";
  }
  if (
    lower.includes("cursor") ||
    lower.includes("copilot") ||
    lower.includes("claude code") ||
    lower.includes("windsurf") ||
    lower.includes("agentic coding") ||
    lower.includes("coding agent") ||
    lower.includes("ai coding")
  ) {
    return "agentic_coding";
  }
  if (lower.includes("ai") || lower.includes("llm") || lower.includes("model")) {
    return "ai_news";
  }
  if (
    lower.includes("cloud") ||
    lower.includes("kubernetes") ||
    lower.includes("aws") ||
    lower.includes("gcp")
  ) {
    return "cloud_platform";
  }
  if (
    lower.includes("architecture") ||
    lower.includes("아키텍처") ||
    lower.includes("system design") ||
    lower.includes("msa") ||
    lower.includes("saga") ||
    lower.includes("outbox")
  ) {
    return "architecture";
  }
  return "backend_engineering";
}

function angleForCategory(category) {
  if (category === "agentic_coding") {
    return "Compare AI coding agents, evaluate productivity impact, and share practical workflows and security considerations for engineering teams.";
  }
  if (category === "ai_news") {
    return "Turn current AI ecosystem news into backend implementation decisions and risk checks.";
  }
  if (category === "spring_backend") {
    return "Explain Spring backend patterns with production-grade tuning, security, and rollout guidance.";
  }
  if (category === "cloud_platform") {
    return "Translate cloud platform updates into concrete architecture and cost/reliability tradeoffs.";
  }
  if (category === "scm") {
    return "Turn SCM updates into actionable engineering decisions across planning, procurement, inventory, and fulfillment systems.";
  }
  if (category === "architecture") {
    return "Explain architecture decisions with tradeoffs, migration path, and real operational constraints.";
  }
  if (category === "frontend") {
    return "Share frontend implementation patterns with performance, UX quality, and scalable component structure.";
  }
  if (category === "software") {
    return "Turn practical software engineering updates into actionable implementation and operations guidance.";
  }
  return "Focus on practical backend engineering patterns and operational decision points.";
}

function scoreUtility(title) {
  const lower = title.toLowerCase();
  const practicalKeywords = [
    "how to",
    "build",
    "design",
    "implement",
    "migration",
    "performance",
    "security",
    "testing",
    "ci",
    "api"
  ];
  const opinionKeywords = ["why", "future", "opinion", "thoughts", "hot take"];

  const practicalHits = practicalKeywords.filter((keyword) => lower.includes(keyword)).length;
  const opinionHits = opinionKeywords.filter((keyword) => lower.includes(keyword)).length;
  return Math.min(100, Math.max(0, 55 + practicalHits * 10 - opinionHits * 15));
}

function scoreSearchIntent(title) {
  const lower = title.toLowerCase();
  const intentHits = SEARCH_INTENT_KEYWORDS.filter((keyword) => lower.includes(keyword)).length;
  const demandHits = HIGH_DEMAND_TERMS.filter((keyword) => containsKeyword(lower, keyword)).length;
  return Math.min(100, 45 + intentHits * 12 + demandHits * 8);
}

function scoreTrend(title) {
  const lower = title.toLowerCase();
  const trendKeywords = [
    "ai",
    "llm",
    "agent",
    "release",
    "spring",
    "kubernetes",
    "aws",
    "gcp",
    "rag",
    "backend",
    "architecture",
    "msa",
    "scm",
    "supply chain",
    "logistics",
    "procurement",
    "inventory",
    "warehouse",
    "frontend",
    "react",
    "next.js",
    "web",
    "cursor",
    "copilot",
    "claude code",
    "windsurf",
    "agentic",
    "coding agent"
  ];
  const hits = trendKeywords.filter((keyword) => containsKeyword(lower, keyword)).length;
  return Math.min(100, 50 + hits * 12);
}

function isFocusedTitle(lowerTitle) {
  if (!containsAnyKeyword(lowerTitle, FOCUS_KEYWORDS)) {
    return false;
  }

  return (
    containsAnyKeyword(lowerTitle, HIGH_DEMAND_TERMS) ||
    containsAnyKeyword(lowerTitle, SEARCH_INTENT_KEYWORDS)
  );
}

function containsAnyKeyword(text, keywords) {
  return keywords.some((keyword) => containsKeyword(text, keyword));
}

function containsKeyword(text, keyword) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (/^[a-z0-9\s-]+$/.test(keyword)) {
    return new RegExp(`\\b${escaped}\\b`, "i").test(text);
  }

  return text.includes(keyword);
}

async function pickWithOpenAi(scored, historyTitles) {
  if (!hasOpenAiKey()) {
    return null;
  }

  try {
    const promptTemplate = await readPromptTemplate("topic-planner.md");
    return await generateStructuredJson({
      systemPrompt: promptTemplate,
      userPrompt: JSON.stringify(
        {
          constraints: {
            focus: [
              "ai_news",
              "agentic_coding",
              "frontend",
              "software",
              "spring_backend",
              "backend_engineering",
              "cloud_platform",
              "scm",
              "architecture"
            ],
            avoid_duplicate_titles: true,
            prioritize_search_intent: true,
            avoid_clickbait: true
          },
          history_titles: historyTitles.slice(0, 30),
          candidate_topics: scored.slice(0, 15).map((item) => ({
            title: item.title,
            category: item.category,
            novelty: item.novelty,
            utility: item.utility,
            trend: item.trend,
            total: item.total,
            default_angle: item.angle
          }))
        },
        null,
        2
      )
    });
  } catch (error) {
    console.warn(`OpenAI topic planner fallback: ${error.message}`);
    return null;
  }
}

function findCandidate(candidates, title) {
  if (!title) {
    return null;
  }

  return candidates.find((candidate) => candidate.title.toLowerCase() === String(title).toLowerCase());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
