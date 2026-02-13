import Link from "next/link";

import { getCategoryCounts } from "../../lib/posts.js";

export const metadata = {
  title: "Categories",
  description: "Browse posts by categories"
};

export default async function CategoriesPage() {
  const categories = await getCategoryCounts();

  return (
    <section className="article">
      <h1>Categories</h1>
      <ul className="related-list">
        {categories.map((item) => (
          <li key={item.category}>
            <Link href={`/categories/${item.category}`}>{item.label}</Link> ({item.count})
          </li>
        ))}
      </ul>
    </section>
  );
}
