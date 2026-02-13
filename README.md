# Sol Dev Blog

Daily automated developer blog pipeline focused on AI news, Spring backend, cloud, and practical backend engineering.

## Goals

- Pick a topic automatically every day.
- Generate a high-quality technical article with references.
- Run quality gates before publishing.
- Publish automatically with safe fallback behavior.

## System Overview

1. `scheduler`: triggers daily workflow.
2. `topic planner`: ranks candidate topics.
3. `research`: gathers and validates sources.
4. `writer`: creates draft article and metadata.
5. `quality gate`: checks factuality, duplication, style, and SEO.
6. `publisher`: creates PR first, then auto-publish after confidence grows.

See `docs/architecture.md` for full details.

## Repository Layout

- `.github/workflows/auto-post.yml`: daily automation workflow.
- `docs/architecture.md`: architecture, data flow, and rollout plan.
- `config/sources.yaml`: topic source and weighting config.
- `schemas/article.schema.json`: article output schema.
- `prompts/*.md`: prompt templates for each pipeline stage.
- `scripts/*.mjs`: executable pipeline stages.

## Operational Defaults

- Schedule: weekdays at 08:00 Asia/Seoul.
- Publish strategy: draft PR mode by default.
- Retry: one retry with backoff for transient failures.
- Alerting: workflow failure notification hook placeholder.

## Run Locally

```bash
npm install
npm run blog:run
npm run dev
```

- `npm run blog:run`: generates a post into `content/posts/`
- `npm run dev`: starts the blog web app at `http://localhost:3000`

## Monetization (Ads)

Set these env vars for Google AdSense:

- `NEXT_PUBLIC_ADSENSE_CLIENT` (example: `ca-pub-xxxxxxxxxxxxxxxx`)
- `NEXT_PUBLIC_ADSENSE_HOME_SLOT`
- `NEXT_PUBLIC_ADSENSE_POST_TOP_SLOT`
- `NEXT_PUBLIC_ADSENSE_POST_BOTTOM_SLOT`

If variables are missing, ad components render nothing.

AdSense review readiness pages are available at:

- `/privacy`
- `/contact`
- `/ads.txt` (auto-generated from `NEXT_PUBLIC_ADSENSE_CLIENT`)

## SEO Features Included

- Canonical URLs from post frontmatter
- Open Graph + Twitter metadata
- JSON-LD (`Blog` / `BlogPosting`)
- Auto-generated `sitemap.xml` and `robots.txt`

Generated artifacts:

- `.autoblog/state/topic.json`
- `.autoblog/state/research.json`
- `.autoblog/out/article.json`
- `.autoblog/out/quality-report.json`
- `content/posts/YYYY-MM-DD-<slug>.mdx`

## Required GitHub Secrets

| Secret | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Yes | Canonical URL, sitemap, robots |
| `VERCEL_TOKEN` | Yes | CI deploy authentication |
| `VERCEL_ORG_ID` | Yes | Vercel org scope |
| `VERCEL_PROJECT_ID` | Yes | Vercel project scope |
| `OPENAI_API_KEY` | No | Reserved for LLM writer integration |
| `SLACK_WEBHOOK_URL` | No | Failure notification hook |
| `NEXT_PUBLIC_CONTACT_EMAIL` | No | Contact page email |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | No | AdSense publisher client ID |
| `NEXT_PUBLIC_ADSENSE_HOME_SLOT` | No | Home page ad slot |
| `NEXT_PUBLIC_ADSENSE_POST_TOP_SLOT` | No | Post top ad slot |
| `NEXT_PUBLIC_ADSENSE_POST_BOTTOM_SLOT` | No | Post bottom ad slot |

## Deployment

- Workflow: `.github/workflows/deploy.yml`
- Trigger: push to `main` (or manual dispatch)
- Target: Vercel production deployment
- Guardrail: `npm run deploy:check` validates required env vars before build/deploy

## Next Build Steps

1. Replace heuristic text generation with direct LLM prompt execution.
2. Add embedding-based duplicate detection.
3. Add weekly analytics report and topic feedback loop.
