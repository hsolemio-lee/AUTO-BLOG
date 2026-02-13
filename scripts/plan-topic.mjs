import fs from "node:fs/promises";
import yaml from "js-yaml";

import { ensureDir, fileExists, readJson, writeJson } from "./lib/io.mjs";
import {
  CONTENT_DIR,
  SOURCES_CONFIG_FILE,
  STATE_DIR,
  TOPIC_FILE
} from "./lib/paths.mjs";
import { jaccardSimilarity } from "./lib/text.mjs";

const FALLBACK_TOPICS = [
  "Practical TypeScript patterns for safer API boundaries",
  "How to design retry logic for distributed systems",
  "Building reliable CI pipelines with incremental checks",
  "Feature flags in modern web applications",
  "Database indexing strategies every backend engineer should know"
];

async function main() {
  await ensureDir(STATE_DIR);
  const config = await loadSourcesConfig();
  const historyTitles = await loadHistoryTitles();
  const candidates = await loadCandidates();

  const scored = candidates
    .map((title) => ({ title, ...scoreCandidate(title, historyTitles, config) }))
    .sort((a, b) => b.total - a.total);

  const selected = scored[0];
  const fallback = scored[1] ?? scored[0];

  const output = {
    date: new Date().toISOString(),
    selected_topic: {
      title: selected.title,
      angle: "Explain the concept with implementation steps and concrete tradeoffs.",
      score: selected.total
    },
    fallback_topic: {
      title: fallback.title,
      angle: "Cover a pragmatic migration path and failure modes.",
      score: fallback.total
    },
    candidates: scored.slice(0, 8)
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
  const fromHn = await fetchHnTitles();
  const merged = [...fromHn, ...FALLBACK_TOPICS];
  return [...new Set(merged)].slice(0, 20);
}

async function fetchHnTitles() {
  try {
    const topIdsResponse = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
    if (!topIdsResponse.ok) {
      return [];
    }

    const ids = (await topIdsResponse.json()).slice(0, 12);
    const titles = [];

    await Promise.all(
      ids.map(async (id) => {
        const itemResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
        if (!itemResponse.ok) {
          return;
        }
        const item = await itemResponse.json();
        if (item?.title && typeof item.title === "string") {
          titles.push(item.title);
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
