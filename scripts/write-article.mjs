import { ensureDir, readJson, writeJson } from "./lib/io.mjs";
import { generateStructuredJson, hasOpenAiKey } from "./lib/openai.mjs";
import { ARTICLE_FILE, OUT_DIR, RESEARCH_FILE } from "./lib/paths.mjs";
import { readPromptTemplate } from "./lib/prompts.mjs";
import { slugify } from "./lib/text.mjs";

const REFERENCE_HEADINGS = ["## References", "## 참고 자료", "## Sources", "## 참고한 글"];

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
    category: llmArticle?.category ?? inferCategory(research.topic),
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
  } else if (
    lower.includes("architecture") ||
    lower.includes("아키텍처") ||
    lower.includes("system design") ||
    lower.includes("msa") ||
    lower.includes("saga")
  ) {
    tags.push("architecture", "system-design");
  } else {
    tags.push("backend-engineering", "architecture");
  }

  return tags.slice(0, 6);
}

function inferCategory(topic) {
  const lower = topic.toLowerCase();
  if (lower.includes("ai") || lower.includes("llm") || lower.includes("model") || lower.includes("rag")) {
    return "ai-news";
  }
  if (lower.includes("spring") || lower.includes("jpa") || lower.includes("jwt")) {
    return "spring-backend";
  }
  if (lower.includes("cloud") || lower.includes("kubernetes") || lower.includes("aws") || lower.includes("gcp")) {
    return "cloud-platform";
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
  return "backend-engineering";
}

function buildMarkdown(research) {
  const headings = pickFallbackHeadings(research.topic);
  const claimLines = research.claims
    .map((claim) => `- ${claim.claim} ([${claim.source_title}](${claim.source_url}))`)
    .join("\n");

  const references = research.source_list
    .map((source) => `- [${source.title}](${source.url})`)
    .join("\n");

  return `${headings.context}

${research.topic} 주제는 현업에서 "좋아 보이는데 실제 운영에 넣기 어렵다"는 반응이 자주 나옵니다. 이유는 단순합니다. 기능 자체보다도 API 계약, 장애 전파 범위, 운영 비용, 팀 대응 속도까지 같이 설계해야 하기 때문입니다. 이 글은 그 부분을 실무 중심으로 정리합니다.

${headings.core}

핵심은 "작게 적용 -> 지표로 검증 -> 안전하게 확장"입니다. 감으로 결정하지 않고, 관측 가능한 기준을 먼저 세우면 실패 확률이 확실히 줄어듭니다. 아래 근거를 실제 의사결정 체크포인트로 사용하세요.

주요 근거:
${claimLines}

${headings.execution}

1. 적용 범위를 서비스 단위 또는 엔드포인트 단위로 한정합니다. (처음부터 전면 적용 금지)
2. 배포 전후 비교 지표(p95, 에러율, 비용, 처리량)를 고정합니다.
3. 실패 시 되돌릴 수 있는 fallback 경로와 롤백 조건을 명시합니다.
4. 릴리즈 후 24시간 관찰 규칙과 알림 임계치를 운영 런북에 연결합니다.

\`\`\`ts
type RolloutGuard = { pass: boolean; reasons: string[] };

export function assertRollout(guard: RolloutGuard): void {
  if (!guard.pass) {
    throw new Error("배포 차단: " + guard.reasons.join(", "));
  }
}
\`\`\`

${headings.risks}

- 기능 도입 속도만 보고 관측 지표를 생략하는 경우
- fallback 없이 신규 경로를 기본 경로로 전환하는 경우
- 비용 변화와 성능 변화를 함께 추적하지 않는 경우
- 장애 대응 주체(누가, 언제, 무엇을) 정의가 없는 경우

${headings.apply}

실무에서는 체크리스트보다 "의사결정 순서"가 더 중요합니다. 아래 순서대로만 실행해도 실패 확률이 크게 줄어듭니다.

1. 먼저 성공 기준과 중단 기준을 한 문장으로 고정합니다.
2. 모니터링 지표를 최소한으로 정리해, 배포 직후 바로 판단할 수 있게 만듭니다.
3. 실패 로그를 중심으로 원인을 정리하고, 다음 배포 전에 룰을 하나만 개선합니다.
4. 팀이 반복해서 쓰는 내용을 문서 템플릿으로 고정해 재사용합니다.

## 참고 자료

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
          min_word_count: 1600,
          writing_requirements: [
            "딱딱한 교과서 톤 대신 현업 엔지니어가 실제로 쓰는 자연스러운 문체로 작성할 것",
            "독자가 바로 적용할 수 있도록 설정값, 의사결정 기준, 실패 사례를 포함할 것",
            "유익성 중심으로 작성하고, 추상적 표현이나 과장 문구를 피할 것",
            "코드 예시는 운영 환경에서 주의할 점과 검증 방법까지 설명할 것",
            "섹션 제목은 주제에 맞게 자연스럽게 구성하고, 매 글마다 동일한 제목을 반복하지 말 것"
          ],
          required_sections: ["최소 4개 이상의 H2 제목", "코드 예시", "마지막 참고자료 섹션"],
          category_options: [
            "ai-news",
            "spring-backend",
            "backend-engineering",
            "cloud-platform",
            "architecture"
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

  if (countH2Sections(normalized) < 4) {
    const headings = pickFallbackHeadings(research.topic);
    normalized += `\n\n${headings.apply}\n\n현업 적용 포인트를 3~4개로 정리해 다음 배포 사이클에 반영하세요.`;
  }

  if (!hasReferenceHeading(normalized)) {
    const references = research.source_list.map((source) => `- [${source.title}](${source.url})`).join("\n");
    normalized += `\n\n## 참고 자료\n\n${references}`;
  }

  return normalized;
}

function pickFallbackHeadings(topic) {
  const presets = [
    {
      context: "## 왜 이 주제가 중요한가",
      core: "## 핵심 아이디어",
      execution: "## 구현할 때 이렇게 접근해보자",
      risks: "## 현업에서 자주 터지는 포인트",
      apply: "## 바로 적용할 때 순서"
    },
    {
      context: "## 배경과 문제 상황",
      core: "## 이 글의 결론부터 말하면",
      execution: "## 구현 전략과 코드 예시",
      risks: "## 놓치기 쉬운 리스크",
      apply: "## 팀에 적용하는 방법"
    },
    {
      context: "## 지금 이걸 다뤄야 하는 이유",
      core: "## 설계 관점에서 본 핵심",
      execution: "## 실전 적용 시나리오",
      risks: "## 운영 단계에서의 함정",
      apply: "## 실행 계획"
    }
  ];

  let hash = 0;
  for (const char of topic) {
    hash = (hash + char.charCodeAt(0)) % presets.length;
  }

  return presets[hash];
}

function countH2Sections(markdown) {
  return (String(markdown).match(/^##\s+/gm) ?? []).length;
}

function hasReferenceHeading(markdown) {
  return REFERENCE_HEADINGS.some((heading) => markdown.includes(heading));
}

function ensureMinLength(markdown, research) {
  if (markdown.length >= 4200 && countWords(markdown) >= 1100) {
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
  while (expanded.length < 4200 || countWords(expanded) < 1100) {
    expanded +=
      "\n- 운영 점검 항목: 지표 분석 기준, 알림 임계치 정의, 장애 복구 시나리오 검증, 배포 후 회고 기록, 아키텍처 의사결정 근거 문서화를 한 사이클로 반복합니다.";
  }

  return expanded;
}

function countWords(markdown) {
  return String(markdown)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
