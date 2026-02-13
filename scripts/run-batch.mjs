import { spawnSync } from "node:child_process";

import { fileExists, readJson } from "./lib/io.mjs";
import { QUALITY_FILE, TOPIC_FILE } from "./lib/paths.mjs";

const targetRaw = process.env.BLOG_POSTS_PER_RUN ?? "5";
const targetPosts = Math.max(1, Number.parseInt(targetRaw, 10) || 5);
const maxAttempts = targetPosts * 3;

const excludedTitles = new Set();
let successCount = 0;
let attempt = 0;

while (successCount < targetPosts && attempt < maxAttempts) {
  attempt += 1;
  console.log(`\n=== Auto post attempt ${attempt}/${maxAttempts} (success ${successCount}/${targetPosts}) ===`);

  const extraEnv = {
    BLOG_EXCLUDE_TITLES: [...excludedTitles].join("||")
  };

  const planOk = run("node", ["scripts/plan-topic.mjs"], extraEnv);
  await trackSelectedTitle(excludedTitles);
  if (!planOk) {
    continue;
  }

  const researchOk = run("node", ["scripts/research.mjs"], extraEnv);
  if (!researchOk) {
    continue;
  }

  const writeOk = run("node", ["scripts/write-article.mjs"], extraEnv);
  if (!writeOk) {
    continue;
  }

  const qualityOk = run("node", ["scripts/quality-gate.mjs"], extraEnv);
  if (!qualityOk) {
    await logQualityFailure();
    continue;
  }

  const publishOk = run("node", ["scripts/publish-pr.mjs"], extraEnv);
  if (!publishOk) {
    continue;
  }

  successCount += 1;
}

if (successCount < targetPosts) {
  throw new Error(
    `Batch generation incomplete: generated ${successCount}/${targetPosts} posts after ${attempt} attempts`
  );
}

console.log(`Batch generation complete: ${successCount} posts`);

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      ...extraEnv
    }
  });

  return result.status === 0;
}

async function trackSelectedTitle(titleSet) {
  if (!(await fileExists(TOPIC_FILE))) {
    return;
  }

  try {
    const topic = await readJson(TOPIC_FILE);
    const selected = topic?.selected_topic?.title;
    if (selected) {
      titleSet.add(String(selected));
    }
  } catch {
    // Ignore parse/read errors and continue attempts.
  }
}

async function logQualityFailure() {
  if (!(await fileExists(QUALITY_FILE))) {
    return;
  }

  try {
    const report = await readJson(QUALITY_FILE);
    const reasons = Array.isArray(report?.reasons) ? report.reasons : [];
    if (reasons.length > 0) {
      console.warn(`Quality gate reasons: ${reasons.join(" | ")}`);
    }
  } catch {
    // Ignore parse/read errors and continue attempts.
  }
}
