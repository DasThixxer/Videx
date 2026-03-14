# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Videx — a zero-dependency, mobile-first video player client. Open `index.html` directly in a browser. No build step, no bundler, no npm.

## Architecture

Five files, no modules — loaded via `<script src>` in this order:

- **`index.html`** — structure only. All IDs are DOM anchors for JS files.
- **`style.css`** — CSS custom properties in `:root` drive the entire theme. Layout is `position: fixed; inset: 0` — the page never scrolls.
- **`spankbang.js`** — all SpankBang-specific logic: playlist/video HTML scraping, related content, search.
- **`pmvhaven.js`** — `PMVH_PLAYLISTS` constant (sort options for the PMVHaven API).
- **`app.js`** — core: globals, DOM refs, source switching, API fetch, player controls, routing, init. Key globals: `SOURCES`, `VIDEOS`, `currentId`, `currentSort`, `currentSource`.

Load order matters — `spankbang.js` and `pmvhaven.js` must load before `app.js` since `app.js` runs an init IIFE on parse.

## Data flow

1. `fetchVideos()` calls `SOURCES[currentSource] + currentSort + "&page=" + page` through `CORS_PROXY`, parses JSON, normalises to `{id, title, src, thumb, duration, views, uploader}`.
2. `renderList()` rebuilds the grid and sidebar `<ul>` from `VIDEOS`.
3. `loadVideo(id)` sets `mainPlayer.src`, updates overlay text, manages prev/next state, pushes URL history.
4. SpankBang videos have no direct `src` — `loadVideo` fetches the video page to extract the mp4 URL via `parseSpankBangVideoSrc()`.
5. On init, URL params (`?source=&v=&playlist=`) are read to restore state.

## Key conventions

- Video IDs are array indices (1-based), not API IDs — they reset on every fetch.
- The `<video>` element has no `controls` attribute — all interaction is custom.
- `renderApiPlaylists()` is source-aware: uses `PMVH_PLAYLISTS` for PMVHaven, `API_PLAYLISTS` for others.
- SpankBang uses direct `fetch()` (no proxy) for HTML pages. API sources go through `CORS_PROXY`.
- Adding a new API source only requires a new entry in `SOURCES` (app.js) and a button in `index.html`.

## CORS proxy

All API fetches go through a single Val.town HTTP val (`CORS_PROXY` in `app.js`). It bypasses Cloudflare WAF restrictions that block Vercel/Netlify/CF Workers for PMVHaven. If the val needs to be redeployed, the source is in `proxies/val-proxy.js` — deploy as an HTTP val at val.town and update `CORS_PROXY`.

## Git identity

Do not add a co-author to commits.

Push with `git push origin main`. The remote is named `origin` and its URL uses the `github-thixxer` SSH host alias (`git@github-thixxer:DasThixxer/Videx.git`) — do not pass `github-thixxer` as the remote name directly.
