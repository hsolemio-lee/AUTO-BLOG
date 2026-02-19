import fs from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";

const POSTS_DIR = path.join(process.cwd(), "content", "posts");
const CATEGORY_LABELS = {
  "ai-news": "AI News",
  frontend: "Frontend",
  "agentic-coding": "Agentic Coding",
  "spring-backend": "Spring Backend",
  "backend-engineering": "Backend Engineering",
  "cloud-platform": "Cloud Platform",
  architecture: "Architecture",
  scm: "SCM"
};

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
      category: normalizeCategory(parsed.data.category, parsed.data.tags ?? []),
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
      category: normalizeCategory(parsed.data.category, parsed.data.tags ?? []),
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

export async function getTagCounts() {
  const posts = await getAllPosts();
  const counts = new Map();

  for (const post of posts) {
    for (const tag of post.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export async function getCategoryCounts() {
  const posts = await getAllPosts();
  const counts = new Map();

  for (const post of posts) {
    counts.set(post.category, (counts.get(post.category) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([category, count]) => ({
      category,
      label: getCategoryLabel(category),
      count
    }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

export async function getPostsByTag(tag) {
  const posts = await getAllPosts();
  return posts.filter((post) => post.tags.includes(tag));
}

export async function getPostsByCategory(category) {
  const posts = await getAllPosts();
  return posts.filter((post) => post.category === category);
}

export function getCategoryLabel(category) {
  return CATEGORY_LABELS[category] ?? category;
}

export function normalizeTagSlug(tag) {
  return encodeURIComponent(tag);
}

export function decodeTagSlug(tagSlug) {
  return decodeURIComponent(tagSlug);
}

function normalizeCategory(frontmatterCategory, tags) {
  if (typeof frontmatterCategory === "string" && frontmatterCategory.trim()) {
    return slugify(frontmatterCategory);
  }

  const lowerTags = tags.map((tag) => String(tag).toLowerCase());
  if (hasAny(lowerTags, ["ai", "ai-news", "llm", "model"])) {
    return "ai-news";
  }
  if (hasAny(lowerTags, ["frontend", "react", "next.js", "vue", "css", "ui-engineering"])) {
    return "frontend";
  }
  if (hasAny(lowerTags, ["agentic-coding", "ai-tool", "developer-productivity"])) {
    return "agentic-coding";
  }
  if (hasAny(lowerTags, ["spring", "spring-backend", "java", "spring security"])) {
    return "spring-backend";
  }
  if (hasAny(lowerTags, ["cloud", "infrastructure", "aws", "gcp", "kubernetes"])) {
    return "cloud-platform";
  }
  if (
    hasAny(lowerTags, [
      "scm",
      "supply-chain",
      "supply chain",
      "logistics",
      "procurement",
      "inventory",
      "warehouse",
      "demand-planning",
      "order-fulfillment"
    ])
  ) {
    return "scm";
  }
  if (hasAny(lowerTags, ["architecture", "system-design", "msa", "saga", "outbox"])) {
    return "architecture";
  }
  return "backend-engineering";
}

function hasAny(list, targets) {
  return targets.some((target) => list.includes(target));
}

function slugify(input) {
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
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
