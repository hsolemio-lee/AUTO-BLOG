# Auto Developer Blog Architecture

## 1) Product Intent

Build an autonomous pipeline that publishes one developer blog post per day with:

- strong technical accuracy,
- clear citations,
- low operational burden,
- and safety controls to avoid low-quality publication.

## 2) High-Level Flow

1. Scheduler triggers at fixed time.
2. Topic planner proposes and scores candidate topics.
3. Research stage fetches references and extracts key facts.
4. Writer stage generates structured article output.
5. Quality gate enforces publication criteria.
6. Publisher either:
   - creates a PR (safe mode), or
   - publishes directly (full auto mode).
7. Metrics collector records outcomes and performance.

## 3) Components

- **Scheduler**: GitHub Actions cron.
- **Topic Planner**:
  - Inputs: source feeds, historical posts, trend signals.
  - Output: selected topic with rationale and angle.
- **Research/RAG**:
  - Inputs: selected topic.
  - Output: citation bundle (URLs, extracted claims, publish dates).
- **Writer**:
  - Inputs: topic + citation bundle + style prompt.
  - Output: JSON/MDX content that matches schema.
- **Quality Gate**:
  - Rules:
    - minimum citations (>=2)
    - duplicate threshold (embedding similarity < 0.85)
    - structure completeness
    - forbidden content checks
  - Output: pass/fail + reason.
- **Publisher**:
  - PR mode: commit generated post into content folder.
  - Direct mode: call CMS API or auto-merge PR.
- **Telemetry**:
  - Records: topic score, gate status, publish status, latency.

## 4) Data Contracts

- Article output must match `schemas/article.schema.json`.
- Frontmatter fields:
  - `title`, `summary`, `date`, `tags`, `slug`, `canonical_url`, `sources`.
- Body sections required:
  - `Problem`, `Core Idea`, `Implementation`, `Pitfalls`, `References`.

## 5) Safety Modes

- **Mode A (recommended start):** Auto-generate + open PR only.
- **Mode B:** Auto-generate + auto-merge if quality score >= threshold.
- **Mode C:** Full direct publish to external CMS.

Rollout path: A -> B -> C based on 2-4 weeks quality metrics.

## 6) Failure Handling

- Retry once for network/model transient failures.
- Keep failed runs in queue file for replay.
- Send alert for:
  - repeated gate failures,
  - publication API failure,
  - empty topic candidate set.

## 7) SEO and Growth Loop

- Auto-generate:
  - meta description,
  - tags,
  - internal link suggestions,
  - social card text.
- Weekly analyzer recommends topic clusters based on:
  - impressions,
  - CTR,
  - dwell time,
  - bounce rate.

## 8) Suggested Runtime Stack

- Orchestration: GitHub Actions
- Runtime: Node.js/TypeScript
- LLM: OpenAI API
- Similarity store: pgvector or local embeddings index
- Blog surface: Next.js + MDX + Vercel (or CMS API)

## 9) Security and Compliance

- Keep all credentials in GitHub Secrets.
- Do not publish if references are missing.
- Include source links in every article.
- Respect source licensing; never copy large verbatim blocks.

## 10) MVP Scope (2 weeks)

- Week 1:
  - topic planner
  - article generation
  - schema validation
  - PR publishing
- Week 2:
  - quality gates
  - duplication check
  - retry + alerting
  - weekly report generation
