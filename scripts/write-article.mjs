import { ensureDir, readJson, writeJson } from "./lib/io.mjs";
import { ARTICLE_FILE, OUT_DIR, RESEARCH_FILE } from "./lib/paths.mjs";
import { slugify } from "./lib/text.mjs";

async function main() {
  await ensureDir(OUT_DIR);
  const research = await readJson(RESEARCH_FILE);

  const title = research.topic;
  const slug = slugify(title);
  const today = new Date().toISOString().slice(0, 10);
  const canonicalBase = process.env.BLOG_BASE_URL ?? "https://example.dev";

  const article = {
    title,
    summary: buildSummary(research.topic),
    slug,
    date: today,
    tags: inferTags(research.topic),
    canonical_url: `${canonicalBase.replace(/\/$/, "")}/blog/${slug}`,
    sources: research.source_list.slice(0, 4),
    content_markdown: buildMarkdown(research)
  };

  await writeJson(ARTICLE_FILE, article);
  console.log(`Article draft generated: ${article.slug}`);
}

function buildSummary(topic) {
  return `A practical guide to ${topic.toLowerCase()}, with concrete implementation details, tradeoffs, and production-ready checks.`;
}

function inferTags(topic) {
  const lower = topic.toLowerCase();
  const tags = ["engineering", "practical-guide"];

  if (lower.includes("typescript")) {
    tags.push("typescript", "api");
  } else if (lower.includes("ci") || lower.includes("pipeline")) {
    tags.push("ci-cd", "automation");
  } else if (lower.includes("docker") || lower.includes("kubernetes")) {
    tags.push("devops", "infrastructure");
  } else {
    tags.push("architecture", "backend");
  }

  return tags.slice(0, 6);
}

function buildMarkdown(research) {
  const profile = buildTopicProfile(research.topic);
  const claimLines = research.claims
    .map((claim) => `- ${claim.claim} ([${claim.source_title}](${claim.source_url}))`)
    .join("\n");

  const references = research.source_list
    .map((source) => `- [${source.title}](${source.url})`)
    .join("\n");

  return `## Problem

${profile.problem}

In many teams, this problem stays invisible until it shows up as failed deploys, delayed reviews, or noisy incidents. By the time symptoms appear, the fix is more expensive because multiple systems already depend on the wrong default behavior.

## Core Idea

${profile.coreIdea}

Key points from current references:
${claimLines}

Use these claims as implementation constraints, not as abstract guidance. If a claim cannot be checked automatically, it usually means the rollout is still too broad.

## Implementation

${profile.steps}

\`\`\`${profile.codeLang}
${profile.codeBlock}
\`\`\`

The important part is not the exact syntax, but the explicit gate condition and fallback path. This ensures engineers can move fast without losing observability.

### Rollout pattern

1. Start in one bounded service or pipeline stage.
2. Add one quality gate that can fail hard.
3. Measure outcome metrics for one week.
4. Expand scope only after stable trends.

## Pitfalls

${profile.pitfalls}

## Practical Checklist

${profile.checklist}

Suggested operating rhythm:

- Daily: generate one candidate and enforce quality checks.
- Weekly: review failures and tune thresholds.
- Monthly: update topic heuristics from reader feedback.

## References

${references}
`;
}

function buildTopicProfile(topic) {
  const lower = topic.toLowerCase();

  if (lower.includes("retry") || lower.includes("distributed")) {
    return {
      problem:
        "Distributed requests fail for many reasons: network jitter, partial outages, and upstream timeouts. Without disciplined retry boundaries, clients either give up too early or amplify failures with synchronized retry storms.",
      coreIdea:
        "Design retries as a reliability budget: bounded attempts, exponential backoff, and idempotent operations. Pair this with circuit-breaker signals so retries stop when dependency health degrades.",
      steps: [
        "1. Classify errors into retryable and non-retryable categories.",
        "2. Set max-attempt and max-elapsed-time per endpoint.",
        "3. Add jitter to avoid synchronized bursts.",
        "4. Emit retry metrics (`attempt_count`, `retry_success`, `terminal_failure`)."
      ].join("\n"),
      codeLang: "ts",
      codeBlock: [
        "type RetryPolicy = { attempts: number; baseMs: number; maxMs: number };",
        "",
        "export async function withRetry(run: () => Promise<Response>, policy: RetryPolicy): Promise<Response> {",
        "  let lastError: unknown;",
        "  for (let attempt = 1; attempt <= policy.attempts; attempt += 1) {",
        "    try {",
        "      return await run();",
        "    } catch (error) {",
        "      lastError = error;",
        "      if (attempt === policy.attempts) break;",
        "      const delay = Math.min(policy.maxMs, policy.baseMs * 2 ** (attempt - 1));",
        "      const jitter = Math.floor(Math.random() * 50);",
        "      await new Promise((resolve) => setTimeout(resolve, delay + jitter));",
        "    }",
        "  }",
        "  throw lastError instanceof Error ? lastError : new Error(\"retry exhausted\");",
        "}"
      ].join("\n"),
      pitfalls: [
        "- Retrying non-idempotent operations can create duplicate writes.",
        "- Missing jitter causes retry waves and cache stampedes.",
        "- No terminal alert makes silent degradation look healthy."
      ].join("\n"),
      checklist: [
        "- [ ] Retry only documented transient errors",
        "- [ ] Idempotency key strategy defined",
        "- [ ] Retry metrics exported to dashboards",
        "- [ ] Circuit-breaker integration verified"
      ].join("\n")
    };
  }

  if (lower.includes("ci") || lower.includes("pipeline")) {
    return {
      problem:
        "CI pipelines often become slow and flaky as checks accumulate. Teams then skip safeguards to regain speed, which raises merge risk and post-deploy failures.",
      coreIdea:
        "Split checks by confidence and cost: run fail-fast validations early, run expensive suites conditionally, and cache dependencies aggressively. The goal is fast feedback without reducing signal quality.",
      steps: [
        "1. Separate lint/type/unit checks into a fast lane.",
        "2. Trigger integration tests only on affected paths.",
        "3. Reuse cache keys tied to lockfiles and tool versions.",
        "4. Publish per-job durations for weekly optimization."
      ].join("\n"),
      codeLang: "yaml",
      codeBlock: [
        "jobs:",
        "  quick-check:",
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - uses: actions/checkout@v4",
        "      - uses: actions/setup-node@v4",
        "      - run: npm ci --prefer-offline",
        "      - run: npm run lint && npm run typecheck && npm test -- --runInBand",
        "  integration:",
        "    needs: quick-check",
        "    if: contains(github.event.pull_request.changed_files, 'api/')",
        "    runs-on: ubuntu-latest",
        "    steps:",
        "      - uses: actions/checkout@v4",
        "      - run: npm run test:integration"
      ].join("\n"),
      pitfalls: [
        "- Running every heavy job on every PR causes queue congestion.",
        "- Unstable cache keys create nondeterministic results.",
        "- No flaky-test policy leads to silent trust erosion."
      ].join("\n"),
      checklist: [
        "- [ ] Fast lane under 10 minutes",
        "- [ ] Heavy jobs path-filtered",
        "- [ ] Cache hit rate monitored",
        "- [ ] Flaky tests quarantined with owner"
      ].join("\n")
    };
  }

  return {
    problem:
      "Engineering initiatives often fail at the integration stage: the idea is valid, but teams cannot translate it into reversible and observable delivery changes.",
    coreIdea:
      "Use a constraints-first rollout. Define objective success metrics, add one mandatory gate, and expand only when outcomes remain stable.",
    steps: [
      "1. Define success and failure thresholds before coding.",
      "2. Add one mandatory gate that blocks unsafe publication.",
      "3. Capture logs, metrics, and owner metadata.",
      "4. Roll out in stages with explicit rollback instructions."
    ].join("\n"),
    codeLang: "ts",
    codeBlock: [
      "type GateReport = { pass: boolean; reasons: string[] };",
      "",
      "export function enforceGate(report: GateReport): void {",
      "  if (!report.pass) {",
      "    throw new Error('publish blocked: ' + report.reasons.join(', '));",
      "  }",
      "}"
    ].join("\n"),
    pitfalls: [
      "- Publishing automation without rollback notes.",
      "- Optimizing volume without measuring quality outcomes.",
      "- Relying on manual checks for repeated risks."
    ].join("\n"),
    checklist: [
      "- [ ] At least 2 reliable references linked",
      "- [ ] Quality gate blocks low-confidence output",
      "- [ ] Duplicate threshold enforced",
      "- [ ] Alert channel tested"
    ].join("\n")
  };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
