"use client";

import { useEffect } from "react";

export default function Comments({ className = "" }) {
  const repo = process.env.NEXT_PUBLIC_GISCUS_REPO;
  const repoId = process.env.NEXT_PUBLIC_GISCUS_REPO_ID;
  const category = process.env.NEXT_PUBLIC_GISCUS_CATEGORY;
  const categoryId = process.env.NEXT_PUBLIC_GISCUS_CATEGORY_ID;
  const mapping = process.env.NEXT_PUBLIC_GISCUS_MAPPING ?? "pathname";
  const theme = process.env.NEXT_PUBLIC_GISCUS_THEME ?? "preferred_color_scheme";

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
    script.setAttribute("data-mapping", mapping);
    script.setAttribute("data-strict", "0");
    script.setAttribute("data-reactions-enabled", "1");
    script.setAttribute("data-emit-metadata", "0");
    script.setAttribute("data-input-position", "top");
    script.setAttribute("data-theme", theme);
    script.setAttribute("data-lang", "ko");

    container.appendChild(script);
  }, [repo, repoId, category, categoryId, mapping, theme]);

  if (!repo || !repoId || !category || !categoryId) {
    return (
      <section className={`comments-block ${className}`.trim()}>
        <div className="comments-head">
          <h2>Comments</h2>
          <p className="meta comments-sub">이 글에 대한 경험이나 의견을 남겨보세요.</p>
        </div>
        <div className="comments-empty">
          <p className="meta">댓글 기능을 활성화하려면 Giscus 환경변수를 설정하세요.</p>
          <p className="meta">README의 Giscus 설정 섹션에서 5분 안에 연결할 수 있습니다.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={`comments-block ${className}`.trim()}>
      <div className="comments-head">
        <h2>Comments</h2>
        <p className="meta comments-sub">실무 적용 경험, 대안, 보완 아이디어를 공유해 주세요.</p>
      </div>
      <div id="comments-root" />
    </section>
  );
}
