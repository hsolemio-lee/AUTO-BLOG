export const metadata = {
  title: "Privacy Policy",
  description: "Privacy policy for Auto Dev Blog"
};

export default function PrivacyPage() {
  return (
    <article className="article">
      <h1>Privacy Policy</h1>
      <p className="meta">Last updated: 2026-02-13</p>
      <section className="content">
        <p>
          This site may collect standard analytics and advertising signals such as page views, referrer data,
          browser metadata, and ad interaction events to improve content quality and sustainability.
        </p>
        <p>
          Third-party services including search analytics, traffic analytics, and advertising networks may store
          cookies or similar identifiers according to their own policies.
        </p>
        <p>
          We do not intentionally collect sensitive personal information. If you need data removal support, contact
          us using the address on the Contact page.
        </p>
      </section>
    </article>
  );
}
