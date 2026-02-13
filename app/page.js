import Link from "next/link";
import Script from "next/script";

import AdSlot from "../components/ad-slot.js";
import { getAllPosts } from "../lib/posts.js";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "../lib/site.js";

const listSchema = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: SITE_NAME,
  description: SITE_DESCRIPTION,
  url: SITE_URL
};

export default async function HomePage() {
  const posts = await getAllPosts();

  return (
    <section className="list-section">
      <Script id="blog-list-schema" strategy="afterInteractive" type="application/ld+json">
        {JSON.stringify(listSchema)}
      </Script>
      <div className="hero-panel">
        <h1>Latest Engineering Briefs</h1>
        <p>
          Daily posts focused on AI ecosystem updates, Spring backend implementation patterns, cloud-native
          reliability, and practical backend techniques.
        </p>
        <div className="topic-row">
          <span>AI News</span>
          <span>Spring Backend</span>
          <span>Backend Engineering</span>
          <span>Cloud Platforms</span>
        </div>
      </div>
      {posts.length === 0 ? (
        <p>No posts yet. Run the automation pipeline to generate your first article.</p>
      ) : (
        <ul className="post-list">
          {posts.map((post) => (
            <li key={post.slug} className="post-card">
              <p className="meta">
                {post.date} · {post.readingTimeMinutes} min read
              </p>
              <h2>
                <Link href={`/blog/${post.slug}`}>{post.title}</Link>
              </h2>
              <p>{post.summary}</p>
              <div className="tag-row">
                {post.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      <AdSlot className="ad-block" slot={process.env.NEXT_PUBLIC_ADSENSE_HOME_SLOT} />
    </section>
  );
}
