import fs from "node:fs/promises";
import path from "node:path";

import { ensureDir, readJson } from "./lib/io.mjs";
import { ARTICLE_FILE, CONTENT_DIR, QUALITY_FILE } from "./lib/paths.mjs";

async function main() {
  await ensureDir(CONTENT_DIR);

  const article = await readJson(ARTICLE_FILE);
  const quality = await readJson(QUALITY_FILE);

  if (!quality.pass) {
    throw new Error("Cannot publish because quality gate did not pass.");
  }

  const filePath = await resolveUniqueFilePath(article.date, article.slug);
  const mdx = buildMdx(article);

  await fs.writeFile(filePath, mdx, "utf8");
  console.log(`Draft post created: ${path.relative(process.cwd(), filePath)}`);
}

async function resolveUniqueFilePath(date, slug) {
  let attempt = 1;
  while (attempt <= 20) {
    const suffix = attempt === 1 ? "" : `-${attempt}`;
    const fileName = `${date}-${slug}${suffix}.mdx`;
    const filePath = path.join(CONTENT_DIR, fileName);

    try {
      await fs.access(filePath);
      attempt += 1;
    } catch {
      return filePath;
    }
  }

  throw new Error(`Unable to find unique file name for slug: ${slug}`);
}

function buildMdx(article) {
  const sourceLines = article.sources.map((source) => `  - title: "${escapeYaml(source.title)}"\n    url: "${escapeYaml(source.url)}"`);

  return `---
title: "${escapeYaml(article.title)}"
summary: "${escapeYaml(article.summary)}"
date: "${article.date}"
slug: "${article.slug}"
canonical_url: "${escapeYaml(article.canonical_url)}"
tags: [${article.tags.map((tag) => `"${escapeYaml(tag)}"`).join(", ")}]
sources:
${sourceLines.join("\n")}
---

${article.content_markdown}
`;
}

function escapeYaml(input) {
  return String(input).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
