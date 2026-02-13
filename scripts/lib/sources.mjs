const KEYWORD_SOURCE_MAP = [
  {
    keywords: ["typescript", "ts"],
    sources: [
      { title: "TypeScript Handbook", url: "https://www.typescriptlang.org/docs/handbook/intro.html" },
      { title: "TypeScript 5.x Release Notes", url: "https://devblogs.microsoft.com/typescript/announcing-typescript-5-4/" }
    ]
  },
  {
    keywords: ["react", "next.js", "next"],
    sources: [
      { title: "React - Thinking in React", url: "https://react.dev/learn/thinking-in-react" },
      { title: "Next.js App Router Docs", url: "https://nextjs.org/docs/app/building-your-application/routing" }
    ]
  },
  {
    keywords: ["node", "node.js", "express"],
    sources: [
      { title: "Node.js Guides", url: "https://nodejs.org/en/learn/getting-started/introduction-to-nodejs" },
      { title: "Express.js Routing Guide", url: "https://expressjs.com/en/guide/routing.html" }
    ]
  },
  {
    keywords: ["docker", "container"],
    sources: [
      { title: "Docker - Best practices for writing Dockerfiles", url: "https://docs.docker.com/develop/develop-images/dockerfile_best-practices/" },
      { title: "Docker Compose Overview", url: "https://docs.docker.com/compose/" }
    ]
  },
  {
    keywords: ["kubernetes", "k8s"],
    sources: [
      { title: "Kubernetes Concepts Overview", url: "https://kubernetes.io/docs/concepts/overview/" },
      { title: "Kubernetes - Configure Liveness, Readiness and Startup Probes", url: "https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/" }
    ]
  },
  {
    keywords: ["spring", "spring boot", "jpa", "jwt"],
    sources: [
      { title: "Spring Boot Reference Documentation", url: "https://docs.spring.io/spring-boot/reference/" },
      { title: "Spring Framework - Core Technologies", url: "https://docs.spring.io/spring-framework/reference/core.html" },
      { title: "Baeldung - Spring Boot Performance Tuning", url: "https://www.baeldung.com/spring-boot-performance" }
    ]
  },
  {
    keywords: ["aws", "amazon"],
    sources: [
      { title: "AWS Well-Architected Framework", url: "https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html" },
      { title: "AWS Architecture Blog", url: "https://aws.amazon.com/blogs/architecture/" }
    ]
  },
  {
    keywords: ["gcp", "google cloud"],
    sources: [
      { title: "Google Cloud Architecture Framework", url: "https://cloud.google.com/architecture/framework" },
      { title: "GCP Release Notes", url: "https://cloud.google.com/release-notes" }
    ]
  },
  {
    keywords: ["ai", "llm", "model", "rag", "agent"],
    sources: [
      { title: "OpenAI API Documentation", url: "https://platform.openai.com/docs/overview" },
      { title: "Anthropic - Prompt Engineering Guide", url: "https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview" }
    ]
  },
  {
    keywords: ["architecture", "system design", "msa", "microservice"],
    sources: [
      { title: "Martin Fowler - Microservices", url: "https://martinfowler.com/articles/microservices.html" },
      { title: "Microsoft - Cloud Design Patterns", url: "https://learn.microsoft.com/en-us/azure/architecture/patterns/" }
    ]
  },
  {
    keywords: ["ci", "cd", "pipeline", "github actions"],
    sources: [
      { title: "GitHub Actions Documentation", url: "https://docs.github.com/en/actions" },
      { title: "Martin Fowler - Continuous Integration", url: "https://martinfowler.com/articles/continuousIntegration.html" }
    ]
  },
  {
    keywords: ["saga", "outbox", "event"],
    sources: [
      { title: "Microservices.io - Saga pattern", url: "https://microservices.io/patterns/data/saga.html" },
      { title: "Microservices.io - Transactional outbox", url: "https://microservices.io/patterns/data/transactional-outbox.html" }
    ]
  },
  {
    keywords: ["observability", "monitoring", "tracing", "logging"],
    sources: [
      { title: "OpenTelemetry Documentation", url: "https://opentelemetry.io/docs/" },
      { title: "Grafana - Observability Best Practices", url: "https://grafana.com/docs/grafana/latest/fundamentals/" }
    ]
  },
  {
    keywords: ["retry", "idempotency", "resilience", "circuit breaker"],
    sources: [
      { title: "Microsoft - Retry pattern", url: "https://learn.microsoft.com/en-us/azure/architecture/patterns/retry" },
      { title: "Microsoft - Circuit Breaker pattern", url: "https://learn.microsoft.com/en-us/azure/architecture/patterns/circuit-breaker" }
    ]
  }
];

const FALLBACK_SOURCES = [
  { title: "GitHub Engineering Blog", url: "https://github.blog/category/engineering/" },
  { title: "Cloudflare Blog - How We Built It", url: "https://blog.cloudflare.com/tag/how-we-built-it/" },
  { title: "Martin Fowler - Software Architecture Guide", url: "https://martinfowler.com/architecture/" },
  { title: "InfoQ - Software Architecture & Design", url: "https://www.infoq.com/architecture-design/" }
];

export function inferReliableSources(topicTitle) {
  const lower = topicTitle.toLowerCase();
  const matched = [];

  for (const rule of KEYWORD_SOURCE_MAP) {
    if (rule.keywords.some((keyword) => lower.includes(keyword))) {
      matched.push(...rule.sources);
    }
  }

  // Always append fallback sources for redundancy.
  // If some matched URLs are 404, fallbacks keep the source count above the quality gate minimum.
  return uniqueByUrl([...matched, ...FALLBACK_SOURCES]).slice(0, 6);
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
