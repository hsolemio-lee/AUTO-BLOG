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

  if (
    lower.includes("cursor") || lower.includes("copilot") || lower.includes("claude code") ||
    lower.includes("windsurf") || lower.includes("agentic") || lower.includes("coding agent")
  ) {
    tags.push("agentic-coding", "ai-tool", "developer-productivity");
  } else if (
    lower.includes("frontend") ||
    lower.includes("react") ||
    lower.includes("next.js") ||
    lower.includes("vue") ||
    lower.includes("css") ||
    lower.includes("ui")
  ) {
    tags.push("frontend", "ui-engineering");
  } else if (lower.includes("ai") || lower.includes("llm") || lower.includes("model")) {
    tags.push("ai-news", "llm");
  } else if (lower.includes("spring")) {
    tags.push("spring-backend", "java");
  } else if (
    lower.includes("scm") ||
    lower.includes("supply chain") ||
    lower.includes("logistics") ||
    lower.includes("procurement") ||
    lower.includes("inventory") ||
    lower.includes("warehouse")
  ) {
    tags.push("scm", "supply-chain");
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
  if (
    lower.includes("cursor") || lower.includes("copilot") || lower.includes("claude code") ||
    lower.includes("windsurf") || lower.includes("agentic") || lower.includes("coding agent") ||
    lower.includes("ai coding")
  ) {
    return "agentic-coding";
  }
  if (lower.includes("ai") || lower.includes("llm") || lower.includes("model") || lower.includes("rag")) {
    return "ai-news";
  }
  if (lower.includes("spring") || lower.includes("jpa") || lower.includes("jwt")) {
    return "spring-backend";
  }
  if (
    lower.includes("scm") ||
    lower.includes("supply chain") ||
    lower.includes("logistics") ||
    lower.includes("procurement") ||
    lower.includes("inventory") ||
    lower.includes("warehouse")
  ) {
    return "scm";
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
  const topic = research.topic;
  const claimsText = research.claims
    .map((claim) => `${claim.claim} ([${claim.source_title}](${claim.source_url}))`)
    .join("\n\n");

  const references = research.source_list
    .map((source) => `- [${source.title}](${source.url})`)
    .join("\n");

  return `${topic}을 실무에 적용하려고 하면, 문서만 읽었을 때와 실제로 운영에 넣었을 때의 차이가 크다는 걸 금방 느끼게 됩니다. 이 글에서는 현업에서 부딪히는 구체적인 문제들과 해결 방향을 정리했습니다.

## ${topic}, 왜 지금 관심을 가져야 하는가

최근 이 주제가 다시 주목받는 데는 이유가 있습니다. 단순히 유행이라서가 아니라, 운영 환경의 복잡도가 높아지면서 이전에는 "나중에 해도 되겠지" 싶었던 부분들이 실제 장애로 이어지는 사례가 늘고 있기 때문입니다.

${claimsText}

## 실제로 적용할 때 알아야 할 것들

이론적으로는 깔끔하지만, 운영 환경에서는 몇 가지 제약 조건을 같이 고려해야 합니다.

첫째, 적용 범위를 처음부터 넓게 잡으면 안 됩니다. 하나의 서비스나 특정 엔드포인트에서 먼저 검증한 뒤 확장하는 게 안전합니다.

둘째, 배포 전후로 비교할 수 있는 지표(p95 응답시간, 에러율, 처리량)를 미리 정해두어야 합니다. "체감상 빨라졌다"는 판단 기준이 될 수 없습니다.

셋째, 실패 시 되돌릴 수 있는 경로를 반드시 만들어 두세요. feature flag든 canary 배포든, 롤백 없이 전면 적용하는 건 사고를 기다리는 것과 같습니다.

## 코드로 보는 적용 예시

아래는 배포 안전 가드를 구현한 간단한 예시입니다. 실제 운영에서는 이런 가드를 CI/CD 파이프라인에 연결해서 자동으로 검증하게 만듭니다.

\`\`\`ts
interface RolloutMetrics {
  p95LatencyMs: number;
  errorRate: number;
  throughputRps: number;
}

function shouldProceedWithRollout(
  before: RolloutMetrics,
  after: RolloutMetrics
): { proceed: boolean; reason: string } {
  if (after.errorRate > before.errorRate * 1.5) {
    return { proceed: false, reason: \`에러율 증가: \${before.errorRate} → \${after.errorRate}\` };
  }
  if (after.p95LatencyMs > before.p95LatencyMs * 1.3) {
    return { proceed: false, reason: \`p95 지연시간 증가: \${before.p95LatencyMs}ms → \${after.p95LatencyMs}ms\` };
  }
  return { proceed: true, reason: "지표 정상 범위 내" };
}
\`\`\`

이 코드의 핵심은 "감이 아니라 숫자로 판단한다"는 원칙입니다. 임계치는 서비스 특성에 맞게 조정하면 됩니다.

## 놓치기 쉬운 운영 이슈

실제로 운영하다 보면 코드 자체보다 주변 환경에서 문제가 생기는 경우가 많습니다.

- 모니터링 지표를 설정해놓고도 알림 임계치를 너무 느슨하게 잡아서 장애를 늦게 인지하는 경우
- 새로운 기술을 도입하면서 기존 팀원들의 학습 시간을 고려하지 않는 경우
- 비용 변화를 성능 변화와 별도로 추적해서 전체 그림을 놓치는 경우
- 장애가 발생했을 때 누가 대응하는지 명확하지 않은 경우

이런 부분들은 코드 리뷰에서 잡히지 않기 때문에, 배포 전 체크리스트에 명시적으로 포함하는 게 좋습니다.

## 다음에 할 일

지금 바로 팀에 적용할 수 있는 액션 아이템을 정리하면:

1. 현재 서비스의 p95 응답시간과 에러율 베이스라인을 측정하세요.
2. 다음 배포 시 위의 배포 가드 패턴을 하나라도 적용해보세요.
3. 장애 발생 시 대응 주체와 절차를 한 페이지짜리 런북으로 만들어두세요.
4. 한 달 뒤 개선 결과를 수치로 비교하고, 팀 회고에서 공유하세요.

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
          min_word_count: 1800,
          writing_requirements: [
            "동료 엔지니어에게 설명하듯 자연스러운 구어체로 작성할 것",
            "매번 같은 섹션 구조(Problem/Core Idea/Implementation/Pitfalls/Checklist)를 반복하지 말 것",
            "섹션 제목은 주제 맥락에 맞는 구체적인 문장형으로 작성할 것",
            "글 시작은 실제 상황이나 질문으로 시작하고, '이 글에서는 X를 다룹니다' 식은 피할 것",
            "구체적인 숫자, 설정값, 실제 사례를 포함할 것",
            "sources 배열에 있는 URL만 사용하고, 절대로 URL을 직접 만들지 말 것"
          ],
          required_sections: ["최소 4개 이상의 주제별 H2 제목", "코드 예시 1개 이상", "마지막에 참고 자료 섹션"],
          category_options: [
            "ai-news",
            "frontend",
            "agentic-coding",
            "spring-backend",
            "backend-engineering",
            "cloud-platform",
            "architecture",
            "scm"
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
    return fallbackSources.slice(0, 6);
  }

  const fallbackUrls = new Set(fallbackSources.map((s) => s.url));

  // Only keep LLM sources whose URLs match our known fallback sources.
  // This prevents hallucinated URLs from making it into the final article.
  const verified = openAiSources
    .filter((source) => source?.title && source?.url && fallbackUrls.has(String(source.url)))
    .map((source) => ({
      title: String(source.title),
      url: String(source.url),
      published_at: source.published_at ?? new Date().toISOString().slice(0, 10)
    }));

  if (verified.length >= 2) {
    return verified.slice(0, 6);
  }

  // Fallback: use the verified research sources directly
  return fallbackSources.slice(0, 6);
}

function normalizeMarkdownStructure(markdown, research) {
  let normalized = markdown;

  if (countH2Sections(normalized) < 4) {
    normalized += `\n\n## 정리하며\n\n${research.topic}을 실무에 적용할 때 가장 중요한 것은 한 번에 완벽하게 하려 하지 않는 것입니다. 작은 범위에서 시작하고, 측정하고, 개선하는 사이클을 반복하세요.`;
  }

  if (!hasReferenceHeading(normalized)) {
    const references = research.source_list.map((source) => `- [${source.title}](${source.url})`).join("\n");
    normalized += `\n\n## 참고 자료\n\n${references}`;
  }

  return normalized;
}

function countH2Sections(markdown) {
  return (String(markdown).match(/^##\s+/gm) ?? []).length;
}

function hasReferenceHeading(markdown) {
  return REFERENCE_HEADINGS.some((heading) => markdown.includes(heading));
}

function ensureMinLength(markdown, research) {
  if (countWords(markdown) >= 1000) {
    return markdown;
  }

  const fallbackClaims = Array.isArray(research.claims) && research.claims.length > 0
    ? research.claims
    : [
        {
          claim: "운영 환경에서는 단계적 도입과 지표 기반 검증이 필수다.",
          source_title: "참고 자료",
          source_url: ""
        }
      ];

  let expanded = markdown;
  let sectionIndex = 1;

  while (countWords(expanded) < 1000 && sectionIndex <= 4) {
    const claimExpansions = fallbackClaims
      .map((claim) => {
        const source = claim.source_url ? `([${claim.source_title}](${claim.source_url}))` : "";
        return `- **${claim.claim}** ${source}\n  실제 적용에서는 트래픽 패턴, 장애 허용 범위, 팀의 온콜 역량을 같이 봐야 합니다. ` +
          `초기에는 전체 전환보다 일부 기능에 먼저 도입하고, 지표가 안정화되는지 확인한 다음 확장하는 방식이 안전합니다. ` +
          `특히 롤백 기준을 사전에 숫자로 정의해 두면 운영 중 의사결정 속도가 크게 좋아집니다.`;
      })
      .join("\n\n");

    expanded +=
      `\n\n## 운영에서 바로 점검할 항목 ${sectionIndex}\n\n${claimExpansions}\n\n` +
      `추가로, 배포 전에는 성능과 안정성뿐 아니라 로그 품질까지 확인해야 합니다. ` +
      `에러 로그가 충분히 구조화되어 있지 않으면 원인 분석 시간이 길어지고, 같은 장애가 반복될 가능성이 높아집니다. ` +
      `배포 후 24시간 관찰 구간에서 경보 임계치를 임시로 강화해 두는 것도 실무에서 자주 쓰는 방법입니다.`;

    sectionIndex += 1;
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
