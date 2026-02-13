import { ensureDir, readJson, writeJson } from "./lib/io.mjs";
import { generateStructuredJson, hasOpenAiKey } from "./lib/openai.mjs";
import { ARTICLE_FILE, OUT_DIR, RESEARCH_FILE } from "./lib/paths.mjs";
import { readPromptTemplate } from "./lib/prompts.mjs";
import { slugify } from "./lib/text.mjs";

const REQUIRED_SECTIONS = [
  "## Problem",
  "## Core Idea",
  "## Implementation",
  "## Pitfalls",
  "## Practical Checklist",
  "## References"
];

async function main() {
  await ensureDir(OUT_DIR);
  const research = await readJson(RESEARCH_FILE);

  const title = research.topic;
  const slug = slugify(title);
  const today = new Date().toISOString().slice(0, 10);
  const canonicalBase = process.env.BLOG_BASE_URL ?? "https://example.dev";

  const llmArticle = await writeWithOpenAi(research, slug);

  const structuredMarkdown = normalizeMarkdownStructure(
    llmArticle?.content_markdown ?? buildMarkdown(research),
    research
  );

  const article = {
    title: llmArticle?.title ?? title,
    summary: llmArticle?.summary ?? buildSummary(research.topic),
    slug,
    date: today,
    tags: llmArticle?.tags?.length ? llmArticle.tags : inferTags(research.topic),
    canonical_url: `${canonicalBase.replace(/\/$/, "")}/blog/${slug}`,
    sources: normalizeSources(llmArticle?.sources, research.source_list),
    content_markdown: ensureMinLength(structuredMarkdown, research)
  };

  await writeJson(ARTICLE_FILE, article);
  console.log(`Article draft generated: ${article.slug}`);
}

function buildSummary(topic) {
  return `${topic}에 대해 백엔드 실무 관점에서 핵심 아키텍처 결정, 운영 리스크, 적용 체크리스트를 정리한 기술 브리핑입니다.`;
}

function inferTags(topic) {
  const lower = topic.toLowerCase();
  const tags = ["backend", "실무가이드"];

  if (lower.includes("ai") || lower.includes("llm") || lower.includes("model")) {
    tags.push("ai-news", "llm");
  } else if (lower.includes("spring")) {
    tags.push("spring-backend", "java");
  } else if (lower.includes("cloud") || lower.includes("kubernetes") || lower.includes("aws")) {
    tags.push("cloud", "infrastructure");
  } else {
    tags.push("backend-engineering", "architecture");
  }

  return tags.slice(0, 6);
}

function buildMarkdown(research) {
  const claimLines = research.claims
    .map((claim) => `- ${claim.claim} ([${claim.source_title}](${claim.source_url}))`)
    .join("\n");

  const references = research.source_list
    .map((source) => `- [${source.title}](${source.url})`)
    .join("\n");

  return `## Problem

${research.topic}은(는) 릴리즈 속도와 운영 안정성 사이의 균형이 핵심입니다. 특히 백엔드 서비스에서는 기능 적용 자체보다, 기존 API 계약/성능/SLO에 어떤 영향을 주는지 먼저 정의하지 않으면 장애 가능성이 빠르게 증가합니다.

## Core Idea

핵심은 "작게 적용하고, 계측하고, 검증한 뒤 확장"입니다. 아래 근거를 기준으로 설계 결정을 내리면 운영 리스크를 크게 줄일 수 있습니다.

주요 근거:
${claimLines}

## Implementation

1. 적용 범위를 서비스 단위 또는 엔드포인트 단위로 한정합니다.
2. 배포 전후 비교 지표(p95, 에러율, 비용, 처리량)를 고정합니다.
3. 실패 시 되돌릴 수 있는 fallback 경로를 명시합니다.
4. 릴리즈 후 24시간 관찰 규칙과 알림 임계치를 설정합니다.

\`\`\`ts
type RolloutGuard = { pass: boolean; reasons: string[] };

export function assertRollout(guard: RolloutGuard): void {
  if (!guard.pass) {
    throw new Error("배포 차단: " + guard.reasons.join(", "));
  }
}
\`\`\`

## Pitfalls

- 기능 도입 속도만 보고 관측 지표를 생략하는 경우
- fallback 없이 신규 경로를 기본 경로로 전환하는 경우
- 비용 변화와 성능 변화를 함께 추적하지 않는 경우

## Practical Checklist

- [ ] 적용 전/후 핵심 지표를 동일 조건으로 비교했다
- [ ] 실패 시 복구 경로를 문서화하고 테스트했다
- [ ] 운영 알림 임계치와 담당자를 지정했다
- [ ] 근거 링크를 문서에 남겼다

## References

${references}
`;
}

async function writeWithOpenAi(research, slug) {
  if (!hasOpenAiKey()) {
    return null;
  }

  try {
    const promptTemplate = await readPromptTemplate("writer.md");
    return await generateStructuredJson({
      systemPrompt: `${promptTemplate}\n\n출력 전체를 한국어(ko-KR)로 작성하라.`,
      userPrompt: JSON.stringify(
        {
          topic: research.topic,
          angle: research.angle,
          slug,
          required_language: "ko-KR",
          required_sections: [
            "## Problem",
            "## Core Idea",
            "## Implementation",
            "## Pitfalls",
            "## Practical Checklist",
            "## References"
          ],
          claims: research.claims,
          sources: research.source_list
        },
        null,
        2
      )
    });
  } catch (error) {
    console.warn(`OpenAI writer fallback: ${error.message}`);
    return null;
  }
}

function normalizeSources(openAiSources, fallbackSources) {
  if (!Array.isArray(openAiSources) || openAiSources.length < 2) {
    return fallbackSources.slice(0, 4);
  }

  const normalized = openAiSources
    .filter((source) => source?.title && source?.url)
    .map((source) => ({
      title: String(source.title),
      url: String(source.url),
      published_at: source.published_at ?? new Date().toISOString().slice(0, 10)
    }));

  return normalized.length >= 2 ? normalized.slice(0, 6) : fallbackSources.slice(0, 4);
}

function normalizeMarkdownStructure(markdown, research) {
  let normalized = markdown;

  for (const section of REQUIRED_SECTIONS) {
    if (!normalized.includes(section)) {
      normalized += `\n\n${section}\n\n`;
      if (section === "## References") {
        const references = research.source_list
          .map((source) => `- [${source.title}](${source.url})`)
          .join("\n");
        normalized += references;
      } else {
        normalized += "자동 생성 결과를 검증 중입니다. 이 섹션은 다음 생성 주기에서 강화됩니다.";
      }
    }
  }

  return normalized;
}

function ensureMinLength(markdown, research) {
  if (markdown.length >= 2100) {
    return markdown;
  }

  const evidence = research.claims
    .map((claim, index) => `${index + 1}. ${claim.claim} (${claim.source_title})`)
    .join("\n");

  const appendix = `

## 운영 적용 메모

아래는 실무 적용 시 바로 점검해야 할 세부 항목입니다.

- 서비스별 위험도(높음/중간/낮음)를 분류하고, 위험도가 높은 경로부터 점진 배포를 적용합니다.
- 기능 배포 전후 지표 비교 구간을 동일하게 유지해 해석 오류를 방지합니다.
- 장애 알림은 담당 팀, 임계치, 대응 절차를 하나의 런북으로 연결합니다.
- 비용 최적화와 성능 최적화를 분리하지 않고 동일 대시보드에서 함께 추적합니다.
- 릴리즈 회고 시 성공 사례뿐 아니라 실패 사례를 반드시 문서화합니다.

### 근거 요약

${evidence}

### 팀 운영 권장사항

1. 월간 기술 부채 점검과 함께 배포 정책을 갱신합니다.
2. 핵심 API에 대한 장애 복구 리허설을 분기별로 수행합니다.
3. 신규 기술 도입 시 성능·보안·비용의 3축 검증표를 유지합니다.
4. 개인 의존성을 줄이기 위해 운영 체크리스트를 템플릿화합니다.
`;

  let expanded = `${markdown}${appendix}`;
  while (expanded.length < 2100) {
    expanded +=
      "\n- 운영 점검 항목: 지표/알림/복구 절차를 동일 릴리즈 기준으로 검증하고, 회고에 근거 링크를 남깁니다.";
  }

  return expanded;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
