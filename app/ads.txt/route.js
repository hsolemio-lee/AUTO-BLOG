export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;

  if (!client) {
    return new Response("", {
      status: 204,
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    });
  }

  const publisherId = client.replace("ca-", "");
  const body = `google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600"
    }
  });
}
