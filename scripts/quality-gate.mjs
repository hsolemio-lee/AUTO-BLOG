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

const REQUIRED_SECTIONS = [
  "## Problem",
  "## Core Idea",
  "## Implementation",
  "## Pitfalls",
  "## Practical Checklist",
  "## References"
];

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

  const missingSections = REQUIRED_SECTIONS.filter(
    (section) => !article.content_markdown.includes(section)
  );
  if (missingSections.length > 0) {
    fail(report, `Missing required sections: ${missingSections.join(", ")}`);
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
