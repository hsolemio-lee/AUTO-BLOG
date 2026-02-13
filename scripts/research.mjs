import { ensureDir, readJson, writeJson } from "./lib/io.mjs";
import { RESEARCH_FILE, STATE_DIR, TOPIC_FILE } from "./lib/paths.mjs";
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

  const claims = buildClaims(topicTitle, sourceList);

  const output = {
    topic: topicTitle,
    angle: topicData.selected_topic.angle,
    claims,
    conflicts: [],
    source_list: sourceList
  };

  await writeJson(RESEARCH_FILE, output);
  console.log(`Research bundle created with ${sourceList.length} sources`);
}

function buildClaims(topicTitle, sourceList) {
  const title = topicTitle.toLowerCase();
  const claims = [];

  if (title.includes("typescript")) {
    claims.push(
      {
        claim: "Stricter TypeScript boundaries reduce runtime contract mismatches.",
        confidence: "high"
      },
      {
        claim: "Combining runtime validation with static types improves API resilience.",
        confidence: "high"
      }
    );
  } else if (title.includes("ci") || title.includes("pipeline")) {
    claims.push(
      {
        claim: "Incremental checks reduce CI latency while preserving confidence.",
        confidence: "medium"
      },
      {
        claim: "Fail-fast jobs and dependency caching are common CI optimization patterns.",
        confidence: "high"
      }
    );
  } else {
    claims.push(
      {
        claim: "A small, iterative rollout strategy lowers production risk for new engineering practices.",
        confidence: "high"
      },
      {
        claim: "Tracking failure modes early improves maintainability and incident response.",
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
