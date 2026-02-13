# Sol Dev Blog

Daily automated developer blog pipeline focused on AI, frontend, backend, cloud, and software architecture topics.

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

- Schedule: every day at 08:00 Asia/Seoul.
- Daily volume: 5 posts per run (`BLOG_POSTS_PER_RUN=5`).
- Publish strategy: draft PR mode by default.
- Retry: one retry with backoff for transient failures.
- Alerting: workflow failure notification hook placeholder.

## Run Locally

```bash
npm install
npm run blog:run
npm run blog:run:batch
npm run dev
```

- `npm run blog:run`: generates a post into `content/posts/`
- `npm run blog:run:batch`: generates multiple posts in one run (default 5)
- `npm run dev`: starts the blog web app at `http://localhost:3000`

Taxonomy and discovery pages:

- `/categories`, `/categories/[category]`
- `/tags`, `/tags/[tag]`

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
- RSS feed endpoint at `/feed.xml`
- Related posts and reading time on post detail pages
- Tag and category browsing pages
- Giscus comment support on post detail pages

## Giscus Setup (Comments)

1. Go to `https://giscus.app`, select your repo, and enable GitHub Discussions.
2. Copy values for repository/category IDs and set these env vars:
   - `NEXT_PUBLIC_GISCUS_REPO`
   - `NEXT_PUBLIC_GISCUS_REPO_ID`
   - `NEXT_PUBLIC_GISCUS_CATEGORY`
   - `NEXT_PUBLIC_GISCUS_CATEGORY_ID`
3. Optional behavior/style tuning:
   - `NEXT_PUBLIC_GISCUS_MAPPING` (`pathname`, `url`, `title`, `og:title`)
   - `NEXT_PUBLIC_GISCUS_THEME` (`preferred_color_scheme`, `light`, `dark`, etc.)
4. Redeploy, then open any `/blog/[slug]` page and verify the comment thread is rendered.

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
| `NEXT_PUBLIC_GISCUS_REPO` | No | Giscus GitHub repo (`owner/repo`) |
| `NEXT_PUBLIC_GISCUS_REPO_ID` | No | Giscus repository ID |
| `NEXT_PUBLIC_GISCUS_CATEGORY` | No | Giscus discussion category |
| `NEXT_PUBLIC_GISCUS_CATEGORY_ID` | No | Giscus category ID |
| `NEXT_PUBLIC_GISCUS_MAPPING` | No | Giscus mapping strategy (default: `pathname`) |
| `NEXT_PUBLIC_GISCUS_THEME` | No | Giscus theme (default: `preferred_color_scheme`) |

## Deployment

- Workflow: `.github/workflows/deploy.yml`
- Trigger: push to `main` (or manual dispatch)
- Target: Vercel production deployment
- Guardrail: `npm run deploy:check` validates required env vars before build/deploy

## Next Build Steps

1. Replace heuristic text generation with direct LLM prompt execution.
2. Add embedding-based duplicate detection.
3. Add weekly analytics report and topic feedback loop.
