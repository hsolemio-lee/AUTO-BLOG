import { getAllPosts } from "../lib/posts.js";
import { SITE_URL } from "../lib/site.js";

export default async function sitemap() {
  const posts = await getAllPosts();

  const items = posts.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: post.date,
    changeFrequency: "daily",
    priority: 0.7
  }));

  return [
    {
      url: SITE_URL,
      lastModified: new Date().toISOString(),
      changeFrequency: "daily",
      priority: 1
    },
    ...items
  ];
}
