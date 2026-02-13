import fs from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import yaml from "js-yaml";

import { ensureDir, fileExists, readJson, writeJson } from "./lib/io.mjs";
import {
  ARTICLE_FILE,
  ARTICLE_SCHEMA_FILE,
  CONTENT_DIR,
  OUT_DIR,
  QUALITY_FILE
} from "./lib/paths.mjs";
import { jaccardSimilarity } from "./lib/text.mjs";

const REFERENCE_HEADINGS = ["## References", "## 참고 자료", "## Sources", "## 참고한 글"];

async function main() {
  await ensureDir(OUT_DIR);

  const article = await readJson(ARTICLE_FILE);
  const schema = await readJson(ARTICLE_SCHEMA_FILE);
  const config = await readQualityConfig();

  const report = {
    pass: true,
    score: 100,
    reasons: [],
    warnings: [],
    actions: []
  };

  const schemaOk = validateSchema(article, schema, report);
  const requiredCitations = config.min_citations ?? 2;
  const similarityThreshold = config.max_similarity_with_existing_posts ?? 0.85;
  const minWordCount = config.min_word_count ?? 900;

  if ((article.sources?.length ?? 0) < requiredCitations) {
    fail(report, `At least ${requiredCitations} citations are required.`);
  }

  // Check for fabricated URLs (common LLM hallucination patterns)
  const fabricatedCount = countFabricatedUrls(article.sources ?? []);
  if (fabricatedCount > 0) {
    fail(report, `${fabricatedCount} source URL(s) appear to be fabricated (contain today's date or suspicious patterns).`);
  }

  const reachableCount = await countReachableSources(article.sources ?? []);
  if (reachableCount < requiredCitations) {
    fail(report, `At least ${requiredCitations} reachable source links are required (found ${reachableCount}).`);
  }

  const h2Count = countH2Sections(article.content_markdown);
  if (h2Count < 4) {
    fail(report, `At least 4 H2 sections are required (found ${h2Count}).`);
  }

  if (!hasReferenceHeading(article.content_markdown)) {
    fail(report, "References section is required.");
  }

  const highestSimilarity = await findHighestSimilarity(article.content_markdown);
  if (highestSimilarity >= similarityThreshold) {
    fail(
      report,
      `Duplicate risk too high (${highestSimilarity.toFixed(2)} >= ${similarityThreshold.toFixed(2)}).`
    );
  }

  const wordCount = countWords(article.content_markdown);
  if (wordCount < minWordCount) {
    fail(report, `Minimum word count not met (${wordCount} < ${minWordCount}).`);
  }

  if (schemaOk && report.pass) {
    report.actions.push("Ready to publish as draft PR.");
  }

  report.score = Math.max(0, 100 - report.reasons.length * 30 - report.warnings.length * 10);
  await writeJson(QUALITY_FILE, report);

  if (!report.pass) {
    console.error("Quality gate failed.");
    if (report.reasons.length > 0) {
      console.error(`Reasons: ${report.reasons.join(" | ")}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Quality gate passed with score ${report.score}`);
}

function validateSchema(article, schema, report) {
  const ajv = new Ajv2020({ allErrors: true });
  addFormats(ajv);

  const validate = ajv.compile(schema);
  const valid = validate(article);

  if (!valid) {
    const errors = validate.errors ?? [];
    for (const error of errors) {
      fail(report, `Schema violation at ${error.instancePath || "/"}: ${error.message}`);
    }
    return false;
  }

  return true;
}

async function readQualityConfig() {
  const sourcesConfig = await fs.readFile("config/sources.yaml", "utf8");
  const parsed = yaml.load(sourcesConfig);

  return {
    min_citations: parsed?.quality?.min_citations ?? 2,
    max_similarity_with_existing_posts: parsed?.quality?.max_similarity_with_existing_posts ?? 0.85,
    min_word_count: parsed?.quality?.min_word_count ?? 900
  };
}

function countWords(markdown) {
  return String(markdown)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

async function findHighestSimilarity(contentMarkdown) {
  if (!(await fileExists(CONTENT_DIR))) {
    return 0;
  }

  const entries = await fs.readdir(CONTENT_DIR);
  let highest = 0;

  for (const fileName of entries) {
    if (!fileName.endsWith(".md") && !fileName.endsWith(".mdx")) {
      continue;
    }

    const content = await fs.readFile(`${CONTENT_DIR}/${fileName}`, "utf8");
    highest = Math.max(highest, jaccardSimilarity(contentMarkdown, content));
  }

  return highest;
}

function fail(report, reason) {
  report.pass = false;
  report.reasons.push(reason);
}

function countFabricatedUrls(sources) {
  const today = new Date().toISOString().slice(0, 10);
  let count = 0;

  for (const source of sources) {
    if (!source?.url) {
      count += 1;
      continue;
    }

    const url = String(source.url);

    // Detect URLs containing today's date (LLMs often embed the current date)
    if (url.includes(today)) {
      count += 1;
      continue;
    }

    // Detect URLs with date patterns that look auto-generated (e.g., /2026-02-13-)
    const dateInPath = url.match(/\/\d{4}-\d{2}-\d{2}[-/]/);
    if (dateInPath) {
      const urlDate = dateInPath[0].slice(1, 11);
      // If the date in the URL is within 7 days of today, likely fabricated
      const daysDiff = Math.abs(Date.now() - new Date(urlDate).getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff < 7) {
        count += 1;
        continue;
      }
    }
  }

  return count;
}

async function countReachableSources(sources) {
  let count = 0;
  for (const source of sources.slice(0, 8)) {
    if (await isReachableUrl(source.url)) {
      count += 1;
    }
  }
  return count;
}

async function isReachableUrl(url) {
  if (!url || typeof url !== "string") {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    let response = await fetch(url, {
      method: "HEAD",
      signal: controller.signal,
      redirect: "follow"
    });

    if (!response.ok || response.status >= 400) {
      response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
        redirect: "follow"
      });
    }

    return response.ok && response.status < 400;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function countH2Sections(markdown) {
  return (String(markdown).match(/^##\s+/gm) ?? []).length;
}

function hasReferenceHeading(markdown) {
  return REFERENCE_HEADINGS.some((heading) => String(markdown).includes(heading));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
