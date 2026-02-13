export function GET() {
  try {
    const rawClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

    if (!rawClient) {
      return new Response("missing NEXT_PUBLIC_ADSENSE_CLIENT\n", {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    }

    const normalized = String(rawClient).trim();
    const match = normalized.match(/^ca-pub-(\d{10,})$/);

    if (!match) {
      return new Response("invalid NEXT_PUBLIC_ADSENSE_CLIENT format\n", {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    }

    const body = `google.com, pub-${match[1]}, DIRECT, f08c47fec0942fa0\n`;
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch {
    return new Response("ads.txt generation error\n", {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    });
  }
}
