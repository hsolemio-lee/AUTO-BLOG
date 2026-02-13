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

const TOPIC_POOLS = {
  ai_news: [
    "What backend teams should adopt from this week's AI platform releases",
    "AI inference cost trends and what they mean for production APIs",
    "How model gateway patterns improve reliability for AI features",
    "Practical RAG architecture updates every backend engineer should track"
  ],
  spring_backend: [
    "Spring Boot 3 production tuning checklist for API latency",
    "Secure Spring Backend authentication with JWT rotation and session hardening",
    "Scaling Spring Data JPA without N+1 and slow query regressions",
    "Event-driven backend design with Spring and outbox pattern"
  ],
  backend_engineering: [
    "Backend reliability patterns for idempotency, retries, and dead-letter queues",
    "Designing stable REST APIs with versioning and backward compatibility",
    "Database transaction boundaries in high-traffic backend services",
    "Practical backend observability with logs, metrics, and distributed tracing"
  ],
  cloud_platform: [
    "Cloud cost optimization for backend workloads with autoscaling guardrails",
    "Kubernetes deployment strategies for zero-downtime backend releases",
    "AWS and GCP managed database tradeoffs for backend teams",
    "Designing resilient cloud architectures with multi-zone failover"
  ]
};

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
  "microservice"
];

async function main() {
  await ensureDir(STATE_DIR);
  const config = await loadSourcesConfig();
  const historyTitles = await loadHistoryTitles();
  const candidates = await loadCandidates();

  const scored = candidates
    .map((candidate) => ({
      title: candidate.title,
      category: candidate.category,
      angle: candidate.angle,
      ...scoreCandidate(candidate.title, historyTitles, config)
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
      score: selected.total
    },
    fallback_topic: {
      title: fallback.title,
      angle: llmDecision?.fallback_topic?.angle ?? fallback.angle,
      score: fallback.total
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

  return titles;
}

async function loadCandidates() {
  const focusedHn = await fetchFocusedHnTitles();
  const poolEntries = Object.entries(TOPIC_POOLS).flatMap(([category, topics]) =>
    topics.map((title) => ({ title, category }))
  );

  const hnEntries = focusedHn.map((title) => ({
    title,
    category: inferCategory(title)
  }));

  const merged = [...hnEntries, ...poolEntries];
  return dedupeCandidates(merged).slice(0, 30);
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
          if (FOCUS_KEYWORDS.some((keyword) => lowered.includes(keyword))) {
            titles.push(item.title);
          }
        }
      })
    );

    return titles;
  } catch {
    return [];
  }
}

function scoreCandidate(title, historyTitles, config) {
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

  const total = Math.round(
    novelty * noveltyWeight + utility * utilityWeight + trend * trendWeight
  );

  return {
    novelty,
    utility,
    trend,
    total,
    reason: "Weighted by novelty, practical utility, and trend signals."
  };
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
      angle: angleForCategory(candidate.category)
    });
  }

  return unique;
}

function inferCategory(title) {
  const lower = title.toLowerCase();

  if (lower.includes("spring")) {
    return "spring_backend";
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
  return "backend_engineering";
}

function angleForCategory(category) {
  if (category === "ai_news") {
    return "Turn current AI ecosystem news into backend implementation decisions and risk checks.";
  }
  if (category === "spring_backend") {
    return "Explain Spring backend patterns with production-grade tuning, security, and rollout guidance.";
  }
  if (category === "cloud_platform") {
    return "Translate cloud platform updates into concrete architecture and cost/reliability tradeoffs.";
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

  const hits = practicalKeywords.filter((keyword) => lower.includes(keyword)).length;
  return Math.min(100, 55 + hits * 10);
}

function scoreTrend(title) {
  const lower = title.toLowerCase();
  const trendKeywords = ["ai", "llm", "agent", "release", "v1", "typescript", "react", "next"];
  const hits = trendKeywords.filter((keyword) => lower.includes(keyword)).length;
  return Math.min(100, 50 + hits * 12);
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
            focus: ["ai_news", "spring_backend", "backend_engineering", "cloud_platform"],
            avoid_duplicate_titles: true
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
