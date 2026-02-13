import Link from "next/link";

import { getTagCounts, normalizeTagSlug } from "../../lib/posts.js";

export const metadata = {
  title: "Tags",
  description: "Browse posts by tags"
};

export default async function TagsPage() {
  const tags = await getTagCounts();

  return (
    <section className="article">
      <h1>Tags</h1>
      <ul className="related-list">
        {tags.map((item) => (
          <li key={item.tag}>
            <Link href={`/tags/${normalizeTagSlug(item.tag)}`}>{item.tag}</Link> ({item.count})
          </li>
        ))}
      </ul>
    </section>
  );
}
