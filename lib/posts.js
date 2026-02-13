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
      tags: parsed.data.tags ?? [],
      readingTimeMinutes: estimateReadingTime(parsed.content),
      markdown: parsed.content
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
      markdown: parsed.content,
      readingTimeMinutes: estimateReadingTime(parsed.content)
    };
  }

  return null;
}

export async function getRelatedPosts(slug, tags, limit = 3) {
  const allPosts = await getAllPosts();
  const tagSet = new Set(tags ?? []);

  const scored = allPosts
    .filter((post) => post.slug !== slug)
    .map((post) => {
      const overlap = post.tags.filter((tag) => tagSet.has(tag)).length;
      return { post, overlap };
    })
    .filter((item) => item.overlap > 0)
    .sort((a, b) => {
      if (b.overlap !== a.overlap) {
        return b.overlap - a.overlap;
      }
      return String(b.post.date).localeCompare(String(a.post.date));
    })
    .slice(0, limit)
    .map((item) => item.post);

  if (scored.length >= limit) {
    return scored;
  }

  const filler = allPosts
    .filter((post) => post.slug !== slug && !scored.some((item) => item.slug === post.slug))
    .slice(0, Math.max(0, limit - scored.length));

  return [...scored, ...filler];
}

function estimateReadingTime(markdown) {
  const words = String(markdown)
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(1, Math.ceil(words / 220));
}

async function safeReadDir(dirPath) {
  try {
    return await fs.readdir(dirPath);
  } catch {
    return [];
  }
}
