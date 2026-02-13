import fs from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";

const POSTS_DIR = path.join(process.cwd(), "content", "posts");

export async function getAllPosts() {
  const files = await safeReadDir(POSTS_DIR);
  const posts = [];

  for (const file of files) {
    if (!file.endsWith(".md") && !file.endsWith(".mdx")) {
      continue;
    }

    const fullPath = path.join(POSTS_DIR, file);
    const raw = await fs.readFile(fullPath, "utf8");
    const parsed = matter(raw);

    posts.push({
      slug: parsed.data.slug,
      title: parsed.data.title,
      summary: parsed.data.summary,
      date: parsed.data.date,
      tags: parsed.data.tags ?? []
    });
  }

  return posts.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export async function getPostBySlug(slug) {
  const files = await safeReadDir(POSTS_DIR);

  for (const file of files) {
    if (!file.endsWith(".md") && !file.endsWith(".mdx")) {
      continue;
    }

    const fullPath = path.join(POSTS_DIR, file);
    const raw = await fs.readFile(fullPath, "utf8");
    const parsed = matter(raw);

    if (parsed.data.slug !== slug) {
      continue;
    }

    return {
      slug: parsed.data.slug,
      title: parsed.data.title,
      summary: parsed.data.summary,
      date: parsed.data.date,
      tags: parsed.data.tags ?? [],
      canonical_url: parsed.data.canonical_url,
      markdown: parsed.content
    };
  }

  return null;
}

async function safeReadDir(dirPath) {
  try {
    return await fs.readdir(dirPath);
  } catch {
    return [];
  }
}
