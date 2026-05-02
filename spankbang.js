import { SB_PLAYLISTS_URL } from "./config.js";
import { state } from "./state.js";
import { makeGridCard, makePlaylistItem, renderList } from "./render.js";
import { openPlayer, closePlayer, renderBreadcrumbs } from "./nav.js";

const videoList            = document.getElementById("videoList");
const playlistList         = document.getElementById("playlistList");
const relatedVideosList    = document.getElementById("relatedVideosList");
const relatedPlaylistsList = document.getElementById("relatedPlaylistsList");
const sbSearchBtn          = document.getElementById("sbSearchBtn");
const sbSearchInput        = document.getElementById("sbSearchInput");
const mainPlayer           = document.getElementById("mainPlayer");
const playerView           = document.getElementById("playerView");
const placeholder          = document.getElementById("playerPlaceholder");
const videoTitle           = document.getElementById("videoTitle");
const videoViews           = document.getElementById("videoViews");
const videoDate            = document.getElementById("videoDate");
const videoDuration        = document.getElementById("videoDuration");
const videoDescription     = document.getElementById("videoDescription");
const prevBtn              = document.getElementById("prevBtn");
const nextBtn              = document.getElementById("nextBtn");

// ─── SpankBang search ─────────────────────────────────────────────────────────

async function performSbSearch(query) {
  query = query.trim();
  if (!query) return;
  state.sbInSearch           = true;
  state.sbMode               = "videos";
  state.sbNextPageUrl        = null;
  state.VIDEOS               = [];
  state.currentPlaylistTitle = `"${query}"`;
  videoList.innerHTML = `<li style="grid-column:1/-1;padding:1.5rem 1rem;color:var(--text-muted);font-size:.85rem;text-align:center;">Searching…</li>`;
  renderBreadcrumbs();
  const url    = `https://spankbang.com/s/${encodeURIComponent(query)}/`;
  const items  = await fetchSpankBang(url);
  state.VIDEOS = items;
  renderList();
}

sbSearchBtn.addEventListener("click", () => performSbSearch(sbSearchInput.value));
sbSearchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") performSbSearch(sbSearchInput.value);
});

// ─── Fetch playlists from profile page ───────────────────────────────────────

export async function fetchSbPlaylists(url) {
  try {
    const res  = await fetch(url);
    const html = await res.text();
    const doc  = new DOMParser().parseFromString(html, "text/html");

    const nodes = doc.querySelectorAll(
      "a[data-testid='playlist-item'], a.playlist-item, .playlist-list a[href], li.playlist-item a[href], a[href*='/playlist/']"
    );

    const results = Array.from(nodes).map((a) => {
      const imgs  = Array.from(a.querySelectorAll("img")).slice(0, 4)
        .map((img) => img.getAttribute("src") || img.getAttribute("data-src") || "");
      const inf   = a.querySelector("p.inf, .title, h3, p");
      const title = inf?.textContent?.trim() || a.getAttribute("title") || "Untitled";
      const href  = new URL(a.getAttribute("href") || "", "https://spankbang.com").href;
      return { title, href, imgs };
    }).filter((p) => p.href !== "https://spankbang.com/" && p.href.includes("/playlist/"));
    return results;
  } catch (err) {
    console.error("[sb] playlists fetch failed:", err);
    return [];
  }
}

// ─── Render playlists grid ────────────────────────────────────────────────────

export function renderPlaylists() {
  videoList.innerHTML    = "";
  playlistList.innerHTML = "";

  if (state.SB_PLAYLISTS.length === 0) {
    videoList.innerHTML = `<li style="grid-column:1/-1;padding:2rem 1rem;color:var(--text-muted);font-size:.85rem;text-align:center;">No playlists found</li>`;
    return;
  }
  state.SB_PLAYLISTS.forEach((pl) => {
    const li = document.createElement("li");
    li.className = "playlist-card";
    const coverClass = pl.imgs.length <= 1 ? "playlist-card-cover single" : "playlist-card-cover";
    li.innerHTML = `
      <div class="${coverClass}">
        ${pl.imgs.map((src) => `<img src="${src}" alt="" loading="lazy" />`).join("")}
      </div>
      <div class="playlist-card-info">
        <div class="playlist-card-title">${pl.title}</div>
      </div>
    `;
    li.addEventListener("click", () => openPlaylist(pl.href, pl.title));
    videoList.appendChild(li);
  });
}

// ─── Drill into a playlist ────────────────────────────────────────────────────

export async function openPlaylist(href, title) {
  state.sbMode               = "videos";
  state.sbCurrentUrl         = href;
  state.sbNextPageUrl        = null;
  state.sbInSearch           = false;
  state.VIDEOS               = [];
  state.currentPlaylistTitle = title;
  videoList.innerHTML = `<li style="grid-column:1/-1;padding:2rem 1rem;color:var(--text-muted);font-size:.85rem;text-align:center;">Loading…</li>`;
  renderBreadcrumbs();
  const items  = await fetchSpankBang(href);
  state.VIDEOS = items;
  renderList();
  if (!state.restoringHistory) history.pushState(null, "", "?source=spankbang&playlist=" + encodeURIComponent(href));
}

// ─── Fetch & scrape video list from playlist page ─────────────────────────────

export async function fetchSpankBang(url, append = false) {
  try {
    const res  = await fetch(url);
    const html = await res.text();
    const doc  = new DOMParser().parseFromString(html, "text/html");

    const root  = doc.querySelector('[data-testid="main"]') ?? doc;
    const nodes = root.querySelectorAll('[data-testid="video-item"]');

    const nextEl         = doc.querySelector(".pagination li.next a[href]");
    state.sbNextPageUrl  = nextEl
      ? new URL(nextEl.getAttribute("href"), "https://spankbang.com").href
      : null;

    const offset = append ? state.VIDEOS.length : 0;
    return Array.from(nodes).map((node, i) => {
      const a        = node.querySelector("a[href]");
      const titleA   = node.querySelector("a[title]");
      const img      = node.querySelector("img");
      const duration = node.querySelector("[data-testid='video-item-length']");
      const src      = a?.getAttribute("href") || "";
      return {
        id:       offset + i + 1,
        title:    titleA?.getAttribute("title") || img?.getAttribute("alt") || "Video",
        src,
        thumb:    img?.getAttribute("src") || img?.getAttribute("data-src") || "",
        duration: duration?.textContent?.trim() || "",
        views:    "",
        uploader: "",
      };
    }).filter((v) => v.src.startsWith("/"));
  } catch (err) {
    console.error("[sb] fetch failed:", err);
    return [];
  }
}

// ─── Extract direct video URL from video page ─────────────────────────────────

export function parseSpankBangVideoSrc(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tag = doc.querySelector("video[src], video source[src]");
  if (tag) return tag.getAttribute("src");

  const urlPattern = /https?:\/\/[^\s"'\\]+\.(mp4|m3u8|webm)[^\s"'\\]*/gi;
  for (const s of doc.querySelectorAll("script:not([src])")) {
    const m = s.textContent.match(urlPattern);
    if (m) return m[0];
  }
  const m = html.match(urlPattern);
  return m ? m[0] : null;
}

// ─── Scrape related videos from video page ────────────────────────────────────

export function scrapeRelatedVideos(doc) {
  const nodes = doc.querySelectorAll(".js-related-videos-right [data-testid='video-item']");
  return Array.from(nodes).map((node) => {
    const a        = node.querySelector("a[href]");
    const titleA   = node.querySelector("a[title]");
    const img      = node.querySelector("img");
    const duration = node.querySelector("[data-testid='video-item-length']");
    const src      = a?.getAttribute("href") || "";
    return {
      title:    titleA?.getAttribute("title") || img?.getAttribute("alt") || "Video",
      src,
      thumb:    img?.getAttribute("src") || img?.getAttribute("data-src") || "",
      duration: duration?.textContent?.trim() || "",
    };
  }).filter((v) => v.src.includes("/video/"));
}

// ─── Scrape related playlists from video page ─────────────────────────────────

export function scrapeRelatedPlaylists(doc) {
  const nodes = doc.querySelectorAll(
    "a[data-testid='playlist-item'], a.playlist-item, [class*='playlist'] a[href*='/playlist/'], a[href*='/playlist/']"
  );
  return Array.from(nodes).map((a) => {
    const imgs  = Array.from(a.querySelectorAll("img")).slice(0, 4)
      .map((img) => img.getAttribute("src") || img.getAttribute("data-src") || "");
    const inf   = a.querySelector("p.inf, .title, p, span");
    const title = inf?.textContent?.trim() || a.getAttribute("title") || a.textContent?.trim() || "Playlist";
    const href  = new URL(a.getAttribute("href") || "", "https://spankbang.com").href;
    return { title, href, imgs };
  }).filter((p) => p.href.includes("/playlist/") && p.href !== "https://spankbang.com/");
}

// ─── Render related videos in right sidebar ───────────────────────────────────

export function renderRelatedVideos(items) {
  relatedVideosList.innerHTML = "";
  if (items.length === 0) {
    relatedVideosList.innerHTML = `<li class="sidebar-empty">None found</li>`;
    return;
  }
  items.forEach((v) => {
    const li = document.createElement("li");
    li.className = "playlist-item";
    li.innerHTML = `
      <div class="playlist-thumb">
        ${v.thumb ? `<img src="${v.thumb}" alt="" loading="lazy" />` : ""}
      </div>
      <div class="playlist-info">
        <div class="playlist-item-title">${v.title}</div>
      </div>
    `;
    li.addEventListener("click", () => playExternalVideo(v));
    relatedVideosList.appendChild(li);
  });
}

// ─── Render related playlists in right sidebar ────────────────────────────────

export function renderRelatedPlaylists(items) {
  relatedPlaylistsList.innerHTML = "";
  if (items.length === 0) {
    relatedPlaylistsList.innerHTML = `<li class="sidebar-empty">None found</li>`;
    return;
  }
  items.forEach((pl) => {
    const li = document.createElement("li");
    li.className = "playlist-item";
    const coverClass = "sidebar-cover" + (pl.imgs.length <= 1 ? " single" : "");
    li.innerHTML = `
      <div class="${coverClass}">
        ${pl.imgs.map((src) => `<img src="${src}" alt="" loading="lazy" />`).join("")}
      </div>
      <div class="playlist-info">
        <div class="playlist-item-title">${pl.title}</div>
      </div>
    `;
    li.addEventListener("click", () => { closePlayer(); openPlaylist(pl.href, pl.title); });
    relatedPlaylistsList.appendChild(li);
  });
}

// ─── Play a related video (not in VIDEOS array) ───────────────────────────────

export async function playExternalVideo(v) {
  if (!v.src) return;
  const pageUrl = new URL(v.src, "https://spankbang.com").href;
  let html;
  try {
    const res = await fetch(pageUrl);
    if (!res.ok) return;
    html = await res.text();
  } catch { return; }

  const videoSrc = parseSpankBangVideoSrc(html);
  if (!videoSrc) return;

  const doc = new DOMParser().parseFromString(html, "text/html");
  renderRelatedVideos(scrapeRelatedVideos(doc));
  renderRelatedPlaylists(scrapeRelatedPlaylists(doc));

  if (!v.title) v.title = doc.querySelector("h1")?.textContent?.trim() || "";
  if (!v.thumb) v.thumb = doc.querySelector('meta[property="og:image"]')?.getAttribute("content") || "";

  mainPlayer.src    = videoSrc;
  mainPlayer.poster = v.thumb;
  mainPlayer.load();
  mainPlayer.play().catch(() => {});
  if (playerView.classList.contains("hidden")) openPlayer();
  placeholder.classList.add("hidden");
  document.querySelectorAll(".video-overlay").forEach((el) => el.classList.add("visible"));

  videoTitle.textContent       = v.title;
  videoTitle.href              = pageUrl;
  videoViews.textContent       = "";
  videoDuration.textContent    = "";
  videoDescription.textContent = "";
  videoDate.textContent        = "";

  prevBtn.disabled    = true;
  nextBtn.disabled    = true;
  state.currentId     = null;
  const plParam2 = state.sbCurrentUrl !== SB_PLAYLISTS_URL
    ? "&playlist=" + encodeURIComponent(state.sbCurrentUrl) : "";
  if (!state.restoringHistory) history.pushState(null, "", "?source=spankbang&v=" + encodeURIComponent(v.src) + plParam2);
  document.querySelectorAll(".playlist-item").forEach((el) => el.classList.remove("active"));
}

// ─── Load more videos (infinite scroll) ──────────────────────────────────────

export async function loadMoreSpankBang() {
  state.sbLoadingMore = true;
  const newItems = await fetchSpankBang(state.sbNextPageUrl, true);
  state.VIDEOS.push(...newItems);
  newItems.forEach((v) => {
    videoList.appendChild(makeGridCard(v));
    playlistList.appendChild(makePlaylistItem(v));
  });
  state.sbLoadingMore = false;
}
