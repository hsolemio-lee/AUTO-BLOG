import Link from "next/link";
import { notFound } from "next/navigation";
import Script from "next/script";
import ReactMarkdown from "react-markdown";

import AdSlot from "../../../components/ad-slot.js";
import { getAllPosts, getPostBySlug, getRelatedPosts } from "../../../lib/posts.js";
import { SITE_NAME } from "../../../lib/site.js";

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return { title: "Post not found" };
  }

  return {
    title: post.title,
    description: post.summary,
    alternates: {
      canonical: post.canonical_url
    },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.summary,
      url: post.canonical_url,
      siteName: SITE_NAME,
      publishedTime: post.date,
      tags: post.tags
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.summary
    }
  };
}

export default async function BlogPostPage({ params }) {
  const { slug } = params;
  const post = await getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.summary,
    datePublished: post.date,
    dateModified: post.date,
    mainEntityOfPage: post.canonical_url,
    url: post.canonical_url,
    author: {
      "@type": "Organization",
      name: SITE_NAME
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME
    },
    keywords: post.tags.join(",")
  };
  const relatedPosts = await getRelatedPosts(post.slug, post.tags, 3);

  return (
    <article className="article">
      <Script id={`post-schema-${post.slug}`} strategy="afterInteractive" type="application/ld+json">
        {JSON.stringify(articleSchema)}
      </Script>
      <p className="meta">
        {post.date} · {post.readingTimeMinutes} min read
      </p>
      <h1>{post.title}</h1>
      <p className="summary">{post.summary}</p>
      <div className="tag-row">
        {post.tags.map((tag) => (
          <span key={tag} className="tag">
            {tag}
          </span>
        ))}
      </div>
      <AdSlot className="ad-block" slot={process.env.NEXT_PUBLIC_ADSENSE_POST_TOP_SLOT} />
      <section className="content">
        <ReactMarkdown>{post.markdown}</ReactMarkdown>
      </section>
      <section className="related-section">
        <h2>Related Posts</h2>
        <ul className="related-list">
          {relatedPosts.map((item) => (
            <li key={item.slug}>
              <Link href={`/blog/${item.slug}`}>{item.title}</Link>
            </li>
          ))}
        </ul>
      </section>
      <AdSlot className="ad-block" slot={process.env.NEXT_PUBLIC_ADSENSE_POST_BOTTOM_SLOT} />
    </article>
  );
}
