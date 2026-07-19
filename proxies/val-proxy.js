// Deploy this at val.town as an HTTP val.
// It acts as a CORS proxy for all Videx API sources.
export default async function(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  const url = new URL(req.url).searchParams.get("url");
  if (!url) return new Response(JSON.stringify({ error: "Missing url param" }), { status: 400 });

  const upstream = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/json,*/*;q=0.9",
      "Accept-Language": "en-US,en;q=0.9",
      "Referer": new URL(url).origin + "/",
    },
  });

  const body = await upstream.text();

  return new Response(body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "text/html",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
