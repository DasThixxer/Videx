# Videx

A zero-dependency, mobile-first video player client for any JSON video API.
Point it at an endpoint, define your field mappings, and get a full-screen player with a browsable sidebar.

## Features

- Full-viewport video player — no native controls, no scrolling UI
- Toggleable sidebar with video list
- Multiple source tabs — switch between API endpoints at runtime
- Sort toggle — configurable per source
- Scroll on video to seek ±1/10th of duration
- Click-to-seek progress bar at the bottom
- Auto-plays next video on end
- Prev / Next navigation
- Selected video persisted in URL hash

## Stack

Vanilla HTML, CSS, JavaScript — no framework, no bundler, no dependencies.
Open `index.html` directly in a browser.

## Adding a source

In `app.js`, add an entry to `SOURCES`:

```js
const SOURCES = {
  mysite: "https://example.com/api/videos?page=1&limit=32&sort=",
};
```

Then map the API response fields in `fetchVideos()`:

```js
return items.map((v, i) => ({
  id:       i + 1,
  title:    v.title,
  src:      v.videoUrl,
  thumb:    v.thumbnailUrl,
  duration: v.duration,
  views:    v.views?.toLocaleString(),
  uploader: v.uploader,
}));
```

Add a tab in `index.html`:

```html
<button class="source-tab" data-source="mysite">My Site</button>
```

## CORS

If the API does not include `Access-Control-Allow-Origin` headers, wrap the fetch URL with a CORS proxy:

```js
const CORS_PROXY = "https://corsproxy.io/?url=";
fetch(CORS_PROXY + encodeURIComponent(url));
```

## Proxy notes

Different sources may require different proxies depending on Cloudflare WAF rules and geo-blocking:

| Source | Proxy | Reason |
|---|---|---|
| All sources | `api.codetabs.com` | Free, no deployment needed, bypasses PMVHaven's Cloudflare WAF |

**Proxies that were tested and failed for PMVHaven:**
- Vercel — 403 (Cloudflare JS challenge)
- Netlify — 403 (UK geo-block on their edge nodes)
- Cloudflare Workers — UK geo-block (PMVHaven blocks UK IPs site-wide)
- Railway — works but requires paid plan after 30 days
- `corsproxy.io` — works locally only (paid for non-localhost origins)
- `allorigins.win` — works but very slow
- Val.town — works but noticeably slow
