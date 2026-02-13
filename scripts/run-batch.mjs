import { spawnSync } from "node:child_process";

const countRaw = process.env.BLOG_POSTS_PER_RUN ?? "5";
const count = Math.max(1, Number.parseInt(countRaw, 10) || 5);

for (let i = 1; i <= count; i += 1) {
  console.log(`\n=== Auto post batch ${i}/${count} ===`);
  run("node", ["scripts/plan-topic.mjs"]);
  run("node", ["scripts/research.mjs"]);
  run("node", ["scripts/write-article.mjs"]);
  run("node", ["scripts/quality-gate.mjs"]);
  run("node", ["scripts/publish-pr.mjs"]);
}

console.log(`Batch generation complete: ${count} posts`);

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: process.env
  });

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }
}
