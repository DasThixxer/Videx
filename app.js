// ─── Config ──────────────────────────────────────────────────────────────────
const SOURCES = {
  porntubeai: "https://porntubeai.com/api/videos?limit=32&sort=",
  pmvhaven:   "https://pmvhaven.com/api/videos?limit=32&sort=",
};
const CORS_PROXY        = "https://corsproxy.io/?url=";
const SB_PLAYLISTS_URL  = "https://spankbang.com/profile/das.thixxer/playlists";

const API_PLAYLISTS = [
  { id: "-views",          title: "Top Views",  desc: "Most viewed videos" },
  { id: "-bayesianRating", title: "Top Rated",  desc: "Highest rated videos" },
];

// ─── State ───────────────────────────────────────────────────────────────────
let currentSort   = "-views";
let currentSource = "porntubeai";
let VIDEOS        = [];
let currentId     = null;

let apiMode       = "playlists"; // "playlists" | "videos"
let sbMode        = "playlists"; // "playlists" | "videos"
let SB_PLAYLISTS  = [];
let sbCurrentUrl  = SB_PLAYLISTS_URL;
let sbNextPageUrl = null;
let sbLoadingMore = false;
let sbInSearch    = false;

let currentPage    = 1;
let apiLoadingMore = false;

// ─── DOM refs ────────────────────────────────────────────────────────────────
const leftNav          = document.getElementById("leftNav");
const navBackdrop      = document.getElementById("navBackdrop");
const navCloseBtn      = document.getElementById("navCloseBtn");
const menuBtn          = document.getElementById("menuBtn");
const sbSearchBar      = document.getElementById("sbSearchBar");
const browseHeader     = document.getElementById("browseHeader");
const browseHeaderTitle = document.getElementById("browseHeaderTitle");
const sbBackBtn        = document.getElementById("sbBackBtn");
const sbSearchInput    = document.getElementById("sbSearchInput");
const sbSearchBtn      = document.getElementById("sbSearchBtn");
const browseView       = document.getElementById("browseView");
const playerView       = document.getElementById("playerView");
const videoList        = document.getElementById("videoList");
const rightSidebar        = document.getElementById("rightSidebar");
const rightSidebarClose   = document.getElementById("rightSidebarClose");
const playlistList        = document.getElementById("playlistList");
const relatedVideosList   = document.getElementById("relatedVideosList");
const relatedPlaylistsList = document.getElementById("relatedPlaylistsList");
const mainPlayer       = document.getElementById("mainPlayer");
const placeholder      = document.getElementById("playerPlaceholder");
const videoTitle       = document.getElementById("videoTitle");
const videoViews       = document.getElementById("videoViews");
const videoDate        = document.getElementById("videoDate");
const videoDuration    = document.getElementById("videoDuration");
const videoDescription = document.getElementById("videoDescription");
const progressBar      = document.getElementById("progressBar");
const progressFill     = document.getElementById("progressFill");
const prevBtn          = document.getElementById("prevBtn");
const nextBtn          = document.getElementById("nextBtn");
const backBtn          = document.getElementById("backBtn");

// ─── Left nav mobile toggle ───────────────────────────────────────────────────
function openNav() {
  leftNav.classList.add("open");
  navBackdrop.classList.add("active");
}

function closeNav() {
  leftNav.classList.remove("open");
  navBackdrop.classList.remove("active");
}

menuBtn.addEventListener("click", openNav);
navCloseBtn.addEventListener("click", closeNav);
navBackdrop.addEventListener("click", closeNav);

// ─── Player show / hide ───────────────────────────────────────────────────────
function openPlayer() {
  browseView.classList.add("hidden");
  playerView.classList.remove("hidden");
  rightSidebar.classList.remove("hidden");
  rightSidebar.classList.toggle("sb-source", currentSource === "spankbang");
  switchSidebarTab("playlist");
}

function closePlayer() {
  playerView.classList.add("hidden");
  rightSidebar.classList.add("hidden");
  browseView.classList.remove("hidden");
  mainPlayer.pause();
  currentId = null;
  relatedVideosList.innerHTML = "";
  relatedPlaylistsList.innerHTML = "";
  switchSidebarTab("playlist");
  renderList();
}

// ─── Click video to toggle pause ─────────────────────────────────────────────
mainPlayer.addEventListener("click", () => {
  if (mainPlayer.paused) mainPlayer.play().catch(() => {});
  else mainPlayer.pause();
});

backBtn.addEventListener("click", closePlayer);
rightSidebarClose.addEventListener("click", closePlayer);

// ─── Right sidebar tab switching ──────────────────────────────────────────────
function switchSidebarTab(tab) {
  document.querySelectorAll(".sidebar-tab").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === tab)
  );
  document.querySelectorAll(".sidebar-list").forEach((el) =>
    el.classList.toggle("active", el.dataset.tab === tab)
  );
}

document.querySelectorAll(".sidebar-tab").forEach((btn) => {
  btn.addEventListener("click", () => switchSidebarTab(btn.dataset.tab));
});

// ─── Source tabs ─────────────────────────────────────────────────────────────
document.querySelectorAll(".source-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const source = btn.dataset.source;
    if (source === currentSource) { closeNav(); return; }

    document.querySelectorAll(".source-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentSource = source;
    currentId     = null;
    sbCurrentUrl  = SB_PLAYLISTS_URL;
    sbNextPageUrl = null;
    sbInSearch    = false;
    sbMode        = "playlists";
    SB_PLAYLISTS  = [];
    VIDEOS        = [];

    const isSb = source === "spankbang";
    sbSearchBar.classList.toggle("hidden", !isSb);
    browseHeader.classList.add("hidden");
    apiMode = "playlists";

    // Return to browse if player is open
    if (playerView.classList.contains("hidden") === false) closePlayer();

    history.replaceState(null, "", "?source=" + source);
    renderList();
    loadSource();
    closeNav();
  });
});

// ─── SpankBang search ────────────────────────────────────────────────────────
async function performSbSearch(query) {
  query = query.trim();
  if (!query) return;
  sbInSearch    = true;
  sbMode        = "videos";
  sbNextPageUrl = null;
  VIDEOS        = [];
  browseHeader.classList.remove("hidden");
  browseHeaderTitle.textContent = `Search: "${query}"`;
  videoList.innerHTML = `<li style="grid-column:1/-1;padding:1.5rem 1rem;color:var(--text-muted);font-size:.85rem;text-align:center;">Searching…</li>`;
  const url   = `https://spankbang.com/s/${encodeURIComponent(query)}/`;
  const items = await fetchSpankBang(url);
  VIDEOS = items;
  renderList();
}

sbSearchBtn.addEventListener("click", () => performSbSearch(sbSearchInput.value));
sbSearchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") performSbSearch(sbSearchInput.value);
});

// ─── Load source ─────────────────────────────────────────────────────────────
async function loadSource() {
  if (currentSource === "spankbang") {
    sbMode       = "playlists";
    SB_PLAYLISTS = await fetchSbPlaylists(SB_PLAYLISTS_URL);
    renderPlaylists();
  } else {
    apiMode = "playlists";
    renderApiPlaylists();
  }
}

// ─── API: render sort-as-playlists cards ─────────────────────────────────────
function renderApiPlaylists() {
  videoList.innerHTML  = "";
  playlistList.innerHTML = "";
  browseHeader.classList.add("hidden");
  API_PLAYLISTS.forEach((pl) => {
    const li = document.createElement("li");
    li.className = "sort-card";
    li.innerHTML = `
      <div class="sort-card-title">${pl.title}</div>
      <div class="sort-card-desc">${pl.desc}</div>
    `;
    li.addEventListener("click", () => openApiPlaylist(pl.id, pl.title));
    videoList.appendChild(li);
  });
}

// ─── API: drill into a sort playlist ─────────────────────────────────────────
async function openApiPlaylist(sortId, title) {
  apiMode      = "videos";
  currentSort  = sortId;
  currentPage  = 1;
  VIDEOS       = [];
  browseHeader.classList.remove("hidden");
  browseHeaderTitle.textContent = title;
  videoList.innerHTML = `<li style="grid-column:1/-1;padding:2rem 1rem;color:var(--text-muted);font-size:.85rem;text-align:center;">Loading…</li>`;
  VIDEOS = await fetchVideos(1);
  renderList();
  history.replaceState(null, "", "?source=" + currentSource + "&playlist=" + encodeURIComponent(sortId));
}

// ─── API fetch ────────────────────────────────────────────────────────────────
async function fetchVideos(page = 1, append = false) {
  try {
    const url  = SOURCES[currentSource] + currentSort + "&page=" + page;
    const res  = await fetch(CORS_PROXY + encodeURIComponent(url));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const offset = append ? VIDEOS.length : 0;
    return (json.videos || json.data || []).map((v, i) => ({
      id:       offset + i + 1,
      title:    v.title,
      src:      v.videoUrl,
      thumb:    v.thumbnailUrl,
      duration: v.duration  || "",
      views:    v.views     ? v.views.toLocaleString() : "",
      uploader: v.uploader  || "",
    }));
  } catch (err) {
    console.error("[api] failed:", err);
    return [];
  }
}

async function loadMoreApiVideos() {
  if (apiLoadingMore) return [];
  apiLoadingMore = true;
  const newItems = await fetchVideos(++currentPage, true);
  VIDEOS.push(...newItems);
  newItems.forEach((v) => {
    videoList.appendChild(makeGridCard(v));
    playlistList.appendChild(makePlaylistItem(v));
  });
  apiLoadingMore = false;
  return newItems;
}

// ─── SpankBang: fetch playlists from profile page ────────────────────────────
async function fetchSbPlaylists(url) {
  try {
    const res  = await fetch(url);
    const html = await res.text();
    const doc  = new DOMParser().parseFromString(html, "text/html");

    // Try multiple selectors SpankBang uses for playlist items
    const nodes = doc.querySelectorAll(
      "a[data-testid='playlist-item'], a.playlist-item, .playlist-list a[href], li.playlist-item a[href]"
    );

    return Array.from(nodes).map((a) => {
      const imgs  = Array.from(a.querySelectorAll("img")).slice(0, 4)
        .map((img) => img.getAttribute("src") || img.getAttribute("data-src") || "");
      const inf   = a.querySelector("p.inf, .title, h3, p");
      const title = inf?.textContent?.trim() || a.getAttribute("title") || "Untitled";
      const href  = new URL(a.getAttribute("href") || "", "https://spankbang.com").href;
      return { title, href, imgs };
    }).filter((p) => p.href !== "https://spankbang.com/" && p.href.includes("/playlist/"));
  } catch (err) {
    console.error("[sb] playlists fetch failed:", err);
    return [];
  }
}

// ─── SpankBang: render playlists grid ────────────────────────────────────────
function renderPlaylists() {
  videoList.innerHTML = "";
  playlistList.innerHTML = "";
  browseHeader.classList.add("hidden");

  if (SB_PLAYLISTS.length === 0) {
    videoList.innerHTML = `<li style="grid-column:1/-1;padding:2rem 1rem;color:var(--text-muted);font-size:.85rem;text-align:center;">No playlists found</li>`;
    return;
  }
  SB_PLAYLISTS.forEach((pl) => {
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

// ─── SpankBang: drill into a playlist ────────────────────────────────────────
async function openPlaylist(href, title) {
  sbMode        = "videos";
  sbCurrentUrl  = href;
  sbNextPageUrl = null;
  sbInSearch    = false;
  VIDEOS        = [];
  browseHeader.classList.remove("hidden");
  browseHeaderTitle.textContent = title;
  videoList.innerHTML = `<li style="grid-column:1/-1;padding:2rem 1rem;color:var(--text-muted);font-size:.85rem;text-align:center;">Loading…</li>`;
  const items = await fetchSpankBang(href);
  VIDEOS = items;
  renderList();
  history.replaceState(null, "", "?source=spankbang&playlist=" + encodeURIComponent(href));
}

// ─── Back to playlists (both SB and API sources) ─────────────────────────────
function goBackToPlaylists() {
  VIDEOS        = [];
  browseView.scrollTop = 0;
  if (currentSource === "spankbang") {
    sbMode        = "playlists";
    sbInSearch    = false;
    sbNextPageUrl = null;
    renderPlaylists();
    history.replaceState(null, "", "?source=spankbang");
  } else {
    apiMode = "playlists";
    renderApiPlaylists();
    history.replaceState(null, "", "?source=" + currentSource);
  }
}

sbBackBtn.addEventListener("click", goBackToPlaylists);

// ─── SpankBang: fetch & scrape video list from playlist page ─────────────────
async function fetchSpankBang(url, append = false) {
  try {
    const res  = await fetch(url);
    const html = await res.text();
    const doc  = new DOMParser().parseFromString(html, "text/html");

    const root  = doc.querySelector('[data-testid="main"]') ?? doc;
    const nodes = root.querySelectorAll('[data-testid="video-item"]');

    const nextEl  = doc.querySelector(".pagination li.next a[href]");
    sbNextPageUrl = nextEl
      ? new URL(nextEl.getAttribute("href"), "https://spankbang.com").href
      : null;

    const offset = append ? VIDEOS.length : 0;
    return Array.from(nodes).map((node, i) => {
      const a   = node.querySelector("a");
      const img = node.querySelector("img");
      return {
        id:       offset + i + 1,
        title:    a?.getAttribute("title") || img?.getAttribute("alt") || `Video ${offset + i + 1}`,
        src:      a?.getAttribute("href") || "",
        thumb:    img?.getAttribute("src") || img?.getAttribute("data-src") || "",
        duration: "",
        views:    "",
        uploader: "",
      };
    });
  } catch (err) {
    console.error("[sb] fetch failed:", err);
    return [];
  }
}

// ─── SpankBang: extract direct video URL from video page ─────────────────────
function parseSpankBangVideoSrc(html) {
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

// ─── SpankBang: scrape related videos from video page ────────────────────────
function scrapeRelatedVideos(doc) {
  // Try several selector patterns SpankBang uses across page types
  const nodes = doc.querySelectorAll(
    '[data-testid="video-item"], .video-item, .video-list li, li.video, .related-videos [href*="/video/"]'
  );
  return Array.from(nodes).map((node) => {
    const a   = node.tagName === "A" ? node : node.querySelector("a[href]");
    const img = node.querySelector("img");
    const src = a?.getAttribute("href") || "";
    return {
      title: a?.getAttribute("title") || img?.getAttribute("alt") || "Video",
      src,
      thumb: img?.getAttribute("src") || img?.getAttribute("data-src") || "",
    };
  }).filter((v) => v.src && (v.src.includes("/v/") || v.src.match(/^\/[a-z0-9]+\/$/)));
}

// ─── SpankBang: scrape related playlists from video page ─────────────────────
function scrapeRelatedPlaylists(doc) {
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
function renderRelatedVideos(items) {
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
function renderRelatedPlaylists(items) {
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
async function playExternalVideo(v) {
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

  // Try to pull title/thumb from the page if not provided
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
  videoViews.textContent       = "";
  videoDuration.textContent    = "";
  videoDescription.textContent = "";
  videoDate.textContent        = "";

  prevBtn.disabled = true;
  nextBtn.disabled = true;
  currentId = null;
  const plParam2 = sbCurrentUrl !== SB_PLAYLISTS_URL
    ? "&playlist=" + encodeURIComponent(sbCurrentUrl) : "";
  history.replaceState(null, "", "?source=spankbang&v=" + encodeURIComponent(v.src) + plParam2);
  document.querySelectorAll(".playlist-item").forEach((el) => el.classList.remove("active"));
}

// ─── Infinite scroll ──────────────────────────────────────────────────────────
browseView.addEventListener("scroll", () => {
  const { scrollTop, scrollHeight, clientHeight } = browseView;
  if (scrollHeight - scrollTop - clientHeight >= 200) return;
  if (currentSource === "spankbang") {
    if (sbMode === "videos" && sbNextPageUrl && !sbLoadingMore) loadMoreSpankBang();
  } else {
    if (apiMode === "videos" && !apiLoadingMore) loadMoreApiVideos();
  }
});

async function loadMoreSpankBang() {
  sbLoadingMore = true;
  const newItems = await fetchSpankBang(sbNextPageUrl, true);
  VIDEOS.push(...newItems);
  newItems.forEach((v) => {
    videoList.appendChild(makeGridCard(v));
    playlistList.appendChild(makePlaylistItem(v));
  });
  sbLoadingMore = false;
}

// ─── Render: grid card (browse view) ─────────────────────────────────────────
function makeGridCard(v) {
  const li = document.createElement("li");
  li.className = "video-card" + (v.id === currentId ? " active" : "");
  li.dataset.id = v.id;
  li.innerHTML = `
    <div class="video-card-thumb">
      ${v.thumb ? `<img src="${v.thumb}" alt="" loading="lazy" />` : ""}
      ${v.duration ? `<span class="duration-badge">${v.duration}</span>` : ""}
    </div>
    <div class="video-card-info">
      <div class="video-card-title">${v.title}</div>
      <div class="video-card-meta">${v.uploader}${v.views ? ` · ${v.views} views` : ""}</div>
    </div>
  `;
  li.addEventListener("click", () => loadVideo(v.id));
  return li;
}

// ─── Render: playlist item (right sidebar) ────────────────────────────────────
function makePlaylistItem(v) {
  const li = document.createElement("li");
  li.className = "playlist-item" + (v.id === currentId ? " active" : "");
  li.dataset.id = v.id;
  li.innerHTML = `
    <div class="playlist-thumb">
      ${v.thumb ? `<img src="${v.thumb}" alt="" loading="lazy" />` : ""}
      ${v.duration ? `<span class="duration-badge">${v.duration}</span>` : ""}
    </div>
    <div class="playlist-info">
      <div class="playlist-item-title">${v.title}</div>
      <div class="playlist-item-meta">${v.uploader}${v.views ? ` · ${v.views} views` : ""}</div>
    </div>
  `;
  li.addEventListener("click", () => loadVideo(v.id));
  return li;
}

// ─── Render both lists ────────────────────────────────────────────────────────
function renderList() {
  videoList.innerHTML = "";
  playlistList.innerHTML = "";
  if (VIDEOS.length === 0) {
    videoList.innerHTML = `<li style="grid-column:1/-1;padding:2rem 1rem;color:var(--text-muted);font-size:.85rem;text-align:center;">Loading…</li>`;
    return;
  }
  VIDEOS.forEach((v) => {
    videoList.appendChild(makeGridCard(v));
    playlistList.appendChild(makePlaylistItem(v));
  });
}

// ─── Build a URL-friendly segment for the currently playing video ────────────
function videoSlug(v) {
  // SB: v.src is already a path like "/abc123/video-title/"
  if (v.src && v.src.startsWith("/")) return v.src;
  // API sources: derive a readable slug from the title
  return "/" + v.title.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

// ─── Load a video ─────────────────────────────────────────────────────────────
async function loadVideo(id) {
  const v = VIDEOS.find((x) => x.id === id);
  if (!v) return;
  currentId = id;

  let videoSrc = v.src;

  if (currentSource === "spankbang" && v.src) {
    relatedVideosList.innerHTML    = `<li class="sidebar-empty">Loading…</li>`;
    relatedPlaylistsList.innerHTML = `<li class="sidebar-empty">Loading…</li>`;

    const pageUrl = new URL(v.src, "https://spankbang.com").href;
    let html;
    try {
      const res = await fetch(pageUrl);
      if (!res.ok) { if (id < VIDEOS.length) loadVideo(id + 1); return; }
      html = await res.text();
    } catch (err) {
      console.error("[sb] video page fetch failed:", err);
      if (id < VIDEOS.length) loadVideo(id + 1);
      return;
    }
    videoSrc = parseSpankBangVideoSrc(html);
    if (!videoSrc) { if (id < VIDEOS.length) loadVideo(id + 1); return; }

    const doc = new DOMParser().parseFromString(html, "text/html");
    renderRelatedVideos(scrapeRelatedVideos(doc));
    renderRelatedPlaylists(scrapeRelatedPlaylists(doc));
  } else {
    relatedVideosList.innerHTML    = "";
    relatedPlaylistsList.innerHTML = "";
  }

  mainPlayer.src    = videoSrc;
  mainPlayer.poster = v.thumb;
  mainPlayer.load();
  mainPlayer.play().catch(() => {});
  placeholder.classList.add("hidden");
  document.querySelectorAll(".video-overlay").forEach((el) => el.classList.add("visible"));

  videoTitle.textContent       = v.title;
  videoViews.textContent       = v.views ? `${v.views} views` : "";
  videoDate.textContent        = "";
  videoDuration.textContent    = v.duration;
  videoDescription.textContent = v.uploader ? `by ${v.uploader}` : "";

  prevBtn.disabled = v.id <= 1;
  nextBtn.disabled = currentSource === "spankbang" && v.id >= VIDEOS.length;
  let plParam = "";
  if (currentSource === "spankbang" && sbCurrentUrl !== SB_PLAYLISTS_URL)
    plParam = "&playlist=" + encodeURIComponent(sbCurrentUrl);
  else if (currentSource !== "spankbang" && apiMode === "videos")
    plParam = "&playlist=" + encodeURIComponent(currentSort);
  history.replaceState(null, "", "?source=" + currentSource + "&v=" + encodeURIComponent(videoSlug(v)) + plParam);

  // Refresh active state in both lists
  document.querySelectorAll(".video-card").forEach((el) =>
    el.classList.toggle("active", +el.dataset.id === id)
  );
  document.querySelectorAll(".playlist-item").forEach((el) =>
    el.classList.toggle("active", +el.dataset.id === id)
  );

  // Scroll active playlist item into view
  const activePl = playlistList.querySelector(".playlist-item.active");
  if (activePl) activePl.scrollIntoView({ block: "nearest" });

  openPlayer();
}

prevBtn.addEventListener("click", () => { if (currentId > 1) loadVideo(currentId - 1); });
nextBtn.addEventListener("click", () => {
  if (currentId < VIDEOS.length) {
    loadVideo(currentId + 1);
  } else if (currentSource !== "spankbang") {
    loadMoreApiVideos().then((items) => { if (items.length) loadVideo(currentId + 1); });
  }
});

// ─── Progress bar ─────────────────────────────────────────────────────────────
mainPlayer.addEventListener("timeupdate", () => {
  if (!mainPlayer.duration) return;
  progressFill.style.width = (mainPlayer.currentTime / mainPlayer.duration * 100) + "%";
});

progressBar.addEventListener("click", (e) => {
  if (!mainPlayer.duration) return;
  mainPlayer.currentTime = (e.offsetX / progressBar.offsetWidth) * mainPlayer.duration;
});

// ─── Auto-play next ───────────────────────────────────────────────────────────
mainPlayer.addEventListener("ended", () => {
  if (currentId < VIDEOS.length) {
    loadVideo(currentId + 1);
  } else if (currentSource !== "spankbang") {
    loadMoreApiVideos().then((items) => { if (items.length) loadVideo(currentId + 1); });
  }
});

// ─── Skip on video error ──────────────────────────────────────────────────────
mainPlayer.addEventListener("error", () => {
  if (currentId != null && currentId < VIDEOS.length) loadVideo(currentId + 1);
});

// ─── Scroll to seek ───────────────────────────────────────────────────────────
mainPlayer.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (!mainPlayer.duration) return;
  const step = mainPlayer.duration / 10;
  mainPlayer.currentTime = Math.min(mainPlayer.duration,
    Math.max(0, mainPlayer.currentTime + (e.deltaY > 0 ? step : -step)));
}, { passive: false });

// ─── Init ─────────────────────────────────────────────────────────────────────
(function init() {
  const params       = new URLSearchParams(location.search);
  const savedSource  = ["porntubeai", "pmvhaven", "spankbang"].includes(params.get("source"))
    ? params.get("source") : "porntubeai";
  const savedVideo   = params.get("v") || null;
  const savedPlaylist = params.get("playlist") || null;

  currentSource = savedSource;
  document.querySelectorAll(".source-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.source === savedSource)
  );

  sbSearchBar.classList.toggle("hidden", savedSource !== "spankbang");

  loadSource().then(async () => {
    // Restore playlist/sort context
    if (savedPlaylist) {
      if (savedSource === "spankbang") {
        const title = savedPlaylist.replace(/\/$/, "").split("/").pop().replace(/-/g, " ");
        await openPlaylist(savedPlaylist, title);
      } else {
        const pl = API_PLAYLISTS.find((p) => p.id === savedPlaylist);
        if (pl) await openApiPlaylist(pl.id, pl.title);
      }
    }
    // Restore video
    if (!savedVideo) return;
    if (savedSource === "spankbang") {
      const match = VIDEOS.find((v) => v.src === savedVideo);
      if (match) loadVideo(match.id);
      else playExternalVideo({ src: savedVideo, title: "", thumb: "" });
    } else {
      const match = VIDEOS.find((v) => videoSlug(v) === savedVideo);
      if (match) loadVideo(match.id);
    }
  });
})();
