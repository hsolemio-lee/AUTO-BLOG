const contactEmail = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hslyjy@gmail.com";

export const metadata = {
  title: "Contact",
  description: "Contact information for Sol Dev Blog"
};

export default function ContactPage() {
  return (
    <article className="article">
      <h1>Contact</h1>
      <section className="content">
        <p>For partnerships, corrections, privacy requests, or ad-related inquiries, contact us by email.</p>
        <p>
          Email: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
        </p>
      </section>
    </article>
  );
}
