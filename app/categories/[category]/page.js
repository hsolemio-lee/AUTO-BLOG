import Link from "next/link";
import { notFound } from "next/navigation";

import { getCategoryLabel, getPostsByCategory } from "../../../lib/posts.js";

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  const label = getCategoryLabel(params.category);
  return {
    title: `${label}`,
    description: `${label} posts`
  };
}

export default async function CategoryPostsPage({ params }) {
  const category = params.category;
  const posts = await getPostsByCategory(category);

  if (posts.length === 0) {
    notFound();
  }

  return (
    <section className="article">
      <h1>Category: {getCategoryLabel(category)}</h1>
      <ul className="related-list">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link href={`/blog/${post.slug}`}>{post.title}</Link>
            <span className="meta"> · {post.date}</span>
          </li>
        ))}
      </ul>
      <p className="meta">
        <Link href="/categories">All categories</Link>
      </p>
    </section>
  );
}
