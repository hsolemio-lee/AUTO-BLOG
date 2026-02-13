const KEYWORD_SOURCE_MAP = [
  {
    keywords: ["typescript", "ts"],
    sources: [
      { title: "TypeScript Handbook", url: "https://www.typescriptlang.org/docs/" },
      { title: "TypeScript 5.x Release Notes", url: "https://devblogs.microsoft.com/typescript/" }
    ]
  },
  {
    keywords: ["react", "next.js", "next"],
    sources: [
      { title: "React Docs", url: "https://react.dev/" },
      { title: "Next.js Docs", url: "https://nextjs.org/docs" }
    ]
  },
  {
    keywords: ["node", "node.js", "express"],
    sources: [
      { title: "Node.js Documentation", url: "https://nodejs.org/en/docs" },
      { title: "Express Guide", url: "https://expressjs.com/en/guide/routing.html" }
    ]
  },
  {
    keywords: ["docker", "container", "kubernetes", "k8s"],
    sources: [
      { title: "Docker Docs", url: "https://docs.docker.com/" },
      { title: "Kubernetes Docs", url: "https://kubernetes.io/docs/" }
    ]
  }
];

const FALLBACK_SOURCES = [
  { title: "GitHub Engineering Blog", url: "https://github.blog/engineering/" },
  { title: "Cloudflare Blog", url: "https://blog.cloudflare.com/" },
  { title: "Martin Fowler", url: "https://martinfowler.com/" }
];

export function inferReliableSources(topicTitle) {
  const lower = topicTitle.toLowerCase();
  const matched = [];

  for (const rule of KEYWORD_SOURCE_MAP) {
    if (rule.keywords.some((keyword) => lower.includes(keyword))) {
      matched.push(...rule.sources);
    }
  }

  if (matched.length >= 2) {
    return uniqueByUrl(matched);
  }

  return uniqueByUrl([...matched, ...FALLBACK_SOURCES]).slice(0, 4);
}

function uniqueByUrl(items) {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    if (seen.has(item.url)) {
      continue;
    }
    seen.add(item.url);
    out.push(item);
  }

  return out;
}
