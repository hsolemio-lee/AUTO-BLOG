"use client";

import { useEffect } from "react";

export default function Comments({ className = "" }) {
  const repo = process.env.NEXT_PUBLIC_GISCUS_REPO;
  const repoId = process.env.NEXT_PUBLIC_GISCUS_REPO_ID;
  const category = process.env.NEXT_PUBLIC_GISCUS_CATEGORY;
  const categoryId = process.env.NEXT_PUBLIC_GISCUS_CATEGORY_ID;

  useEffect(() => {
    if (!repo || !repoId || !category || !categoryId) {
      return;
    }

    const container = document.getElementById("comments-root");
    if (!container || container.hasChildNodes()) {
      return;
    }

    const script = document.createElement("script");
    script.src = "https://giscus.app/client.js";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.setAttribute("data-repo", repo);
    script.setAttribute("data-repo-id", repoId);
    script.setAttribute("data-category", category);
    script.setAttribute("data-category-id", categoryId);
    script.setAttribute("data-mapping", "pathname");
    script.setAttribute("data-strict", "0");
    script.setAttribute("data-reactions-enabled", "1");
    script.setAttribute("data-emit-metadata", "0");
    script.setAttribute("data-input-position", "top");
    script.setAttribute("data-theme", "preferred_color_scheme");
    script.setAttribute("data-lang", "ko");

    container.appendChild(script);
  }, [repo, repoId, category, categoryId]);

  if (!repo || !repoId || !category || !categoryId) {
    return (
      <section className={`comments-block ${className}`.trim()}>
        <h2>Comments</h2>
        <p className="meta">댓글 기능을 활성화하려면 Giscus 환경변수를 설정하세요.</p>
      </section>
    );
  }

  return (
    <section className={`comments-block ${className}`.trim()}>
      <h2>Comments</h2>
      <div id="comments-root" />
    </section>
  );
}
