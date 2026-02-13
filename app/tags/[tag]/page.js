import Link from "next/link";
import { notFound } from "next/navigation";

import { decodeTagSlug, getPostsByTag, normalizeTagSlug } from "../../../lib/posts.js";

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  const tag = decodeTagSlug(params.tag);
  return {
    title: `${tag} Tag`,
    description: `${tag} tag posts`
  };
}

export default async function TagPostsPage({ params }) {
  const tag = decodeTagSlug(params.tag);
  const posts = await getPostsByTag(tag);

  if (posts.length === 0) {
    notFound();
  }

  return (
    <section className="article">
      <h1>Tag: {tag}</h1>
      <ul className="related-list">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link href={`/blog/${post.slug}`}>{post.title}</Link>
            <span className="meta"> · {post.date}</span>
          </li>
        ))}
      </ul>
      <p className="meta">
        <Link href="/tags">All tags</Link>
      </p>
      <div className="tag-row">
        {posts[0].tags.map((item) => (
          <Link key={item} className="tag" href={`/tags/${normalizeTagSlug(item)}`}>
            {item}
          </Link>
        ))}
      </div>
    </section>
  );
}
