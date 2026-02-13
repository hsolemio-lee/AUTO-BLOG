import Link from "next/link";

import "./globals.css";

import AdSenseScript from "../components/adsense-script.js";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "../lib/site.js";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AdSenseScript />
        <div className="shell">
          <header className="header">
            <a className="brand" href="/">
              Auto Dev Blog
            </a>
            <p className="tagline">Daily practical engineering notes, generated and reviewed by quality gates.</p>
            <nav className="meta-nav" aria-label="Site">
              <Link href="/privacy">Privacy</Link>
              <Link href="/contact">Contact</Link>
            </nav>
          </header>
          <main>{children}</main>
          <footer className="footer">
            <p>Built for automated engineering publishing.</p>
          </footer>
        </div>
      </body>
    </html>
  );
}
