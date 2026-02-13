import { ensureDir, readJson, writeJson } from "./lib/io.mjs";
import { generateStructuredJson, hasOpenAiKey } from "./lib/openai.mjs";
import { RESEARCH_FILE, STATE_DIR, TOPIC_FILE } from "./lib/paths.mjs";
import { readPromptTemplate } from "./lib/prompts.mjs";
import { inferReliableSources } from "./lib/sources.mjs";

async function main() {
  await ensureDir(STATE_DIR);
  const topicData = await readJson(TOPIC_FILE);
  const topicTitle = topicData.selected_topic.title;

  const baseSources = inferReliableSources(topicTitle);
  const sourceList = baseSources.map((source) => ({
    ...source,
    published_at: new Date().toISOString().slice(0, 10)
  }));

  const llmResearch = await buildResearchWithOpenAi({
    topic: topicTitle,
    angle: topicData.selected_topic.angle,
    sourceList
  });

  const trustedSourceList = buildTrustedSourceList(sourceList, llmResearch?.source_list);

  const claims = normalizeClaims(
    llmResearch?.claims ?? buildClaims(topicTitle, trustedSourceList),
    trustedSourceList
  );

  const output = {
    topic: topicTitle,
    angle: topicData.selected_topic.angle,
    claims,
    conflicts: llmResearch?.conflicts ?? [],
    source_list: trustedSourceList
  };

  await writeJson(RESEARCH_FILE, output);
  console.log(`Research bundle created with ${sourceList.length} sources`);
}

function buildTrustedSourceList(baseSourceList, llmSourceList) {
  if (!Array.isArray(llmSourceList) || llmSourceList.length === 0) {
    return baseSourceList;
  }

  const byUrl = new Map(baseSourceList.map((source) => [source.url, source]));

  for (const source of llmSourceList) {
    if (!source?.url || !source?.title) {
      continue;
    }
    if (!isValidHttpUrl(source.url)) {
      continue;
    }

    if (byUrl.has(source.url)) {
      byUrl.set(source.url, {
        ...byUrl.get(source.url),
        title: String(source.title)
      });
      continue;
    }

    byUrl.set(source.url, {
      title: String(source.title),
      url: String(source.url),
      published_at: source.published_at ?? new Date().toISOString().slice(0, 10)
    });
  }

  return [...byUrl.values()].slice(0, 6);
}

function normalizeClaims(claims, sourceList) {
  if (!Array.isArray(claims) || claims.length === 0) {
    return buildClaims("", sourceList);
  }

  return claims.map((claim, index) => {
    const fallbackSource = sourceList[index % sourceList.length];
    const selectedSource =
      sourceList.find((source) => source.url === claim?.source_url) ??
      sourceList.find((source) => source.title === claim?.source_title) ??
      fallbackSource;

    return {
      claim: String(claim?.claim ?? "검증 가능한 근거를 기반으로 적용해야 합니다."),
      source_url: selectedSource.url,
      source_title: selectedSource.title,
      confidence: claim?.confidence ?? "medium"
    };
  });
}

function isValidHttpUrl(url) {
  try {
    const parsed = new URL(String(url));
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function buildClaims(topicTitle, sourceList) {
  const title = topicTitle.toLowerCase();
  const claims = [];

  if (title.includes("ai") || title.includes("llm") || title.includes("model")) {
    claims.push(
      {
        claim: "AI 모델 릴리즈 변경사항은 백엔드 계약(API 응답 스키마, 지연시간, 비용)을 함께 점검해야 안정적으로 반영할 수 있다.",
        confidence: "high"
      },
      {
        claim: "모델 게이트웨이 계층에서 fallback 모델과 타임아웃 정책을 분리하면 장애 전파를 줄일 수 있다.",
        confidence: "high"
      }
    );
  } else if (title.includes("spring")) {
    claims.push(
      {
        claim: "Spring 백엔드 성능 최적화는 트랜잭션 범위 축소와 쿼리 패턴 최적화(N+1 제거)가 핵심이다.",
        confidence: "high"
      },
      {
        claim: "JWT 키 회전과 짧은 토큰 만료 정책은 Spring 보안 운영에서 필수적인 기본값이다.",
        confidence: "high"
      }
    );
  } else if (title.includes("cloud") || title.includes("kubernetes") || title.includes("aws") || title.includes("gcp")) {
    claims.push(
      {
        claim: "클라우드 백엔드는 오토스케일링 상한과 비용 경보를 함께 설정해야 비용 급증을 방지할 수 있다.",
        confidence: "high"
      },
      {
        claim: "멀티 AZ/멀티 존 장애 전환 테스트는 설계 문서보다 실제 복구 시나리오 검증에 더 중요하다.",
        confidence: "medium"
      }
    );
  } else if (title.includes("ci") || title.includes("pipeline")) {
    claims.push(
      {
        claim: "증분 체크 전략은 CI 시간을 줄이면서도 품질 신호를 유지하는 데 효과적이다.",
        confidence: "medium"
      },
      {
        claim: "Fail-fast 단계와 의존성 캐시는 CI 최적화의 가장 검증된 패턴이다.",
        confidence: "high"
      }
    );
  } else {
    claims.push(
      {
        claim: "작은 범위의 점진적 배포 전략은 신규 백엔드 기능의 운영 리스크를 낮춘다.",
        confidence: "high"
      },
      {
        claim: "실패 유형을 초기부터 계측하면 유지보수성과 장애 대응 속도가 개선된다.",
        confidence: "high"
      }
    );
  }

  return claims.map((claim, index) => {
    const source = sourceList[index % sourceList.length];
    return {
      ...claim,
      source_url: source.url,
      source_title: source.title
    };
  });
}

async function buildResearchWithOpenAi({ topic, angle, sourceList }) {
  if (!hasOpenAiKey()) {
    return null;
  }

  try {
    const promptTemplate = await readPromptTemplate("researcher.md");
    return await generateStructuredJson({
      systemPrompt: `${promptTemplate}\n\n모든 claim과 설명은 한국어로 작성하라.`,
      userPrompt: JSON.stringify(
        {
          topic,
          angle,
          required_language: "ko-KR",
          preferred_sources: sourceList,
          focus_scope: ["AI news", "Spring backend", "Backend engineering", "Cloud platforms"]
        },
        null,
        2
      )
    });
  } catch (error) {
    console.warn(`OpenAI research fallback: ${error.message}`);
    return null;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
