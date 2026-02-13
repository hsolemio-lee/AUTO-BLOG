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

const TOPIC_POOLS = {
  ai_news: [
    "2026년 AI 에이전트 백엔드 아키텍처 실전 가이드",
    "RAG 성능 병목 원인과 해결 체크리스트 (백엔드 관점)",
    "LLM API 비용 최적화: 토큰 비용 절감 설계 패턴",
    "AI 모델 업데이트 대응 전략: 장애 없이 배포하는 방법"
  ],
  spring_backend: [
    "Spring Boot 3 성능 최적화: p95 지연시간 줄이는 실전 방법",
    "Spring Security JWT 운영 가이드: 키 회전과 토큰 만료 전략",
    "Spring Data JPA N+1 문제 해결: 쿼리 튜닝 실전",
    "Spring 이벤트 기반 백엔드: Outbox 패턴 적용 가이드"
  ],
  backend_engineering: [
    "백엔드 장애 대응 가이드: Retry, Idempotency, DLQ 설계",
    "REST API 버전 관리 전략: 호환성 유지 실전 패턴",
    "고트래픽 백엔드 트랜잭션 경계 설계 방법",
    "백엔드 관측성 구축: 로그·메트릭·트레이싱 실전 체크리스트"
  ],
  cloud_platform: [
    "클라우드 비용 최적화: 백엔드 오토스케일링 가드레일 설계",
    "Kubernetes 무중단 배포 전략: 롤링/카나리 비교 가이드",
    "AWS vs GCP 백엔드 선택 기준: 관리형 DB 비교",
    "멀티 AZ 장애 복구 설계: 클라우드 백엔드 고가용성 패턴"
  ],
  architecture: [
    "MSA 전환 시 도메인 경계 설계: 모놀리스 분해 아키텍처 가이드",
    "이벤트 기반 아키텍처 설계: Saga와 Outbox 패턴 실전 비교",
    "대규모 백엔드 아키텍처 리뷰 체크리스트: 장애를 줄이는 설계 기준",
    "백엔드 아키텍처 의사결정 기록(ADR) 작성법과 운영 적용 팁"
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
  "microservice",
  "architecture",
  "system design",
  "msa",
  "saga",
  "outbox"
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
  "event-driven"
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

  const excludeFromEnv = process.env.BLOG_EXCLUDE_TITLES
    ? process.env.BLOG_EXCLUDE_TITLES.split("||").map((item) => item.trim()).filter(Boolean)
    : [];
  titles.push(...excludeFromEnv);

  return titles;
}

async function loadCandidates() {
  const focusedHn = await fetchFocusedHnTitles();
  const trendEntries = await fetchTrendEntries({ maxPerFeed: 6 });

  const poolEntries = Object.entries(TOPIC_POOLS)
    .flatMap(([category, topics]) => topics.map((title) => ({ title, category })))
    .slice(0, 10)
    .map((item) => ({ ...item, source_type: "pool" }));

  const hnEntries = focusedHn.map((title) => ({
    title,
    category: inferCategory(title),
    source_type: "hn"
  }));

  const trendCandidates = trendEntries
    .filter((entry) => isFocusedTitle(entry.title.toLowerCase()))
    .map((entry) => ({
      title: entry.title,
      category: entry.category,
      source: entry.source,
      source_type: "trend"
    }));

  const dynamicCandidates = dedupeCandidates([...trendCandidates, ...hnEntries]);
  const needsPoolFallback = dynamicCandidates.length < 18;
  const merged = needsPoolFallback
    ? [...dynamicCandidates, ...poolEntries]
    : dynamicCandidates;

  if (!needsPoolFallback) {
    console.log(`Using dynamic candidates only (${dynamicCandidates.length})`);
  }

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
          if (isFocusedTitle(lowered)) {
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
  if (category === "ai_news") {
    return "Turn current AI ecosystem news into backend implementation decisions and risk checks.";
  }
  if (category === "spring_backend") {
    return "Explain Spring backend patterns with production-grade tuning, security, and rollout guidance.";
  }
  if (category === "cloud_platform") {
    return "Translate cloud platform updates into concrete architecture and cost/reliability tradeoffs.";
  }
  if (category === "architecture") {
    return "Explain architecture decisions with tradeoffs, migration path, and real operational constraints.";
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
    "msa"
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
              "spring_backend",
              "backend_engineering",
              "cloud_platform",
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
