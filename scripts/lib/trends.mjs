const FEED_TIMEOUT_MS = 12000;

export const TREND_FEEDS = [
  { category: "software", source: "GeekNews", url: "https://news.hada.io/rss/news" },
  { category: "ai_news", source: "WIRED AI", url: "https://www.wired.com/feed/tag/ai/latest/rss" },
  { category: "ai_news", source: "Google AI Blog", url: "https://ai.googleblog.com/feeds/posts/default" },
  { category: "frontend", source: "web.dev", url: "https://web.dev/feed.xml" },
  { category: "software", source: "TypeScript Blog", url: "https://devblogs.microsoft.com/typescript/feed/" },
  { category: "spring_backend", source: "Spring Blog", url: "https://spring.io/blog.atom" },
  { category: "backend_engineering", source: "InfoQ", url: "https://www.infoq.com/feed/" },
  {
    category: "cloud_platform",
    source: "GCP Release Notes",
    url: "https://cloud.google.com/feeds/gcp-release-notes.xml"
  },
  { category: "scm", source: "Supply Chain Dive", url: "https://www.supplychaindive.com/feeds/news/" },
  { category: "architecture", source: "Martin Fowler", url: "https://martinfowler.com/feed.atom" },
  { category: "cloud_platform", source: "Azure Updates", url: "https://azure.microsoft.com/updates/feed/" }
];

export async function fetchTrendEntries({ maxPerFeed = 6 } = {}) {
  const settled = await Promise.allSettled(
    TREND_FEEDS.map(async (feed) => {
      const xml = await fetchWithTimeout(feed.url, FEED_TIMEOUT_MS);
      const parsed = parseFeed(xml, feed);
      return parsed.slice(0, maxPerFeed);
    })
  );

  const entries = [];
  for (const item of settled) {
    if (item.status === "fulfilled") {
      entries.push(...item.value);
    }
  }

  return entries;
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "SolDevBlogBot/1.0 (+https://solemio.dev)"
      }
    });

    if (!response.ok) {
      throw new Error(`Feed fetch failed ${response.status}`);
    }

    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

function parseFeed(xml, feed) {
  const rssItems = extractBlocks(xml, "item");
  const atomEntries = extractBlocks(xml, "entry");
  const blocks = rssItems.length > 0 ? rssItems : atomEntries;

  return blocks
    .map((block) => parseEntryBlock(block, feed))
    .filter((entry) => entry.title && entry.url)
    .map((entry) => ({
      ...entry,
      title: sanitize(entry.title)
    }));
}

function parseEntryBlock(block, feed) {
  const title = matchTag(block, "title");
  const url = matchTag(block, "link") || matchHref(block);
  const publishedAt =
    matchTag(block, "pubDate") || matchTag(block, "updated") || matchTag(block, "published") || "";

  return {
    title,
    url,
    published_at: publishedAt,
    source: feed.source,
    category: feed.category
  };
}

function extractBlocks(xml, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  const blocks = [];
  let match = regex.exec(xml);

  while (match !== null) {
    blocks.push(match[1]);
    match = regex.exec(xml);
  }

  return blocks;
}

function matchTag(block, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = block.match(regex);
  return match ? sanitize(match[1]) : "";
}

function matchHref(block) {
  const match = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>(?:<\/link>)?/i);
  return match ? sanitize(match[1]) : "";
}

function sanitize(value) {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
