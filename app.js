// ─── Config ──────────────────────────────────────────────────────────────────
const SOURCES = {
  porntubeai: "https://porntubeai.com/api/videos?limit=32&sort=",
  pmvhaven:   "https://pmvhaven.com/api/videos?limit=32&sort=",
};
const CORS_PROXY = "https://dasthixxer--ca079a1a1fd511f18ce442dde27851f2.web.val.run/?url=";
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
let restoringHistory = false;

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
const placeholder      = document.getElementById("playerPlaceholder");
const mainPlayer       = document.getElementById("mainPlayer");
const progressBar      = document.getElementById("progressBar");
const progressFill     = document.getElementById("progressFill");
const videoList        = document.getElementById("videoList");
const playlistList     = document.getElementById("playlistList");
const videoTitle       = document.getElementById("videoTitle");
const videoViews       = document.getElementById("videoViews");
const videoDate        = document.getElementById("videoDate");
const videoDuration    = document.getElementById("videoDuration");
const videoDescription = document.getElementById("videoDescription");
const prevBtn          = document.getElementById("prevBtn");
const nextBtn          = document.getElementById("nextBtn");
const backBtn          = document.getElementById("backBtn");
const rightSidebar     = document.getElementById("rightSidebar");
const rightSidebarClose = document.getElementById("rightSidebarClose");
const sidebarShowBtn   = document.getElementById("sidebarShowBtn");
const relatedVideosList    = document.getElementById("relatedVideosList");
const relatedPlaylistsList = document.getElementById("relatedPlaylistsList");

// ─── Nav ──────────────────────────────────────────────────────────────────────
function isMobile() { return window.innerWidth < 768; }
function closeNav() {
  leftNav.classList.remove("open");
  navBackdrop.classList.remove("visible");
}

menuBtn.addEventListener("click", () => {
  if (isMobile()) {
    leftNav.classList.add("open");
    navBackdrop.classList.add("visible");
  } else {
    leftNav.classList.toggle("collapsed");
    document.body.classList.toggle("left-nav-collapsed");
  }
});
navCloseBtn.addEventListener("click", () => {
  if (isMobile()) closeNav();
  else {
    leftNav.classList.add("collapsed");
    document.body.classList.add("left-nav-collapsed");
  }
});
navBackdrop.addEventListener("click", closeNav);

// ─── Player show / hide ───────────────────────────────────────────────────────
function openPlayer() {
  browseView.classList.add("hidden");
  playerView.classList.remove("hidden");
  rightSidebar.classList.remove("hidden");
  rightSidebar.classList.toggle("sb-source", currentSource === "spankbang");
  sidebarShowBtn.classList.add("hidden");
  switchSidebarTab("playlist");
}

function closePlayer() {
  playerView.classList.add("hidden");
  rightSidebar.classList.add("hidden");
  sidebarShowBtn.classList.add("hidden");
  browseView.classList.remove("hidden");
  mainPlayer.pause();
  currentId = null;
  relatedVideosList.innerHTML = "";
  relatedPlaylistsList.innerHTML = "";
  switchSidebarTab("playlist");
  renderList();
}

mainPlayer.addEventListener("click", () => {
  if (mainPlayer.paused) mainPlayer.play().catch(() => {});
  else mainPlayer.pause();
});

backBtn.addEventListener("click", () => history.back());
rightSidebarClose.addEventListener("click", () => {
  rightSidebar.classList.add("hidden");
  sidebarShowBtn.classList.remove("hidden");
});
sidebarShowBtn.addEventListener("click", () => {
  rightSidebar.classList.remove("hidden");
  sidebarShowBtn.classList.add("hidden");
});

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

    if (playerView.classList.contains("hidden") === false) closePlayer();

    if (!restoringHistory) history.pushState(null, "", "?source=" + source);
    renderList();
    loadSource();
    closeNav();
  });
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
  const playlists = currentSource === "pmvhaven" ? PMVH_PLAYLISTS : API_PLAYLISTS;
  playlists.forEach((pl) => {
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
  if (!restoringHistory) history.pushState(null, "", "?source=" + currentSource + "&playlist=" + encodeURIComponent(sortId));
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
    if (!restoringHistory) history.pushState(null, "", "?source=spankbang");
  } else {
    apiMode = "playlists";
    renderApiPlaylists();
    if (!restoringHistory) history.pushState(null, "", "?source=" + currentSource);
  }
}

// ─── API fetch ────────────────────────────────────────────────────────────────
async function fetchVideos(page = 1, append = false) {
  try {
    const url   = SOURCES[currentSource] + currentSort + "&page=" + page;
    const proxy = CORS_PROXY;
    const res   = await fetch(proxy + encodeURIComponent(url));
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
  if (v.src && v.src.startsWith("/")) return v.src; // SB path
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

  videoTitle.textContent = v.title;
  videoTitle.href        = currentSource === "spankbang"
    ? new URL(v.src, "https://spankbang.com").href
    : v.src;
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
  if (!restoringHistory) history.pushState(null, "", "?source=" + currentSource + "&v=" + encodeURIComponent(videoSlug(v)) + plParam);

  document.querySelectorAll(".video-card").forEach((el) =>
    el.classList.toggle("active", +el.dataset.id === id)
  );
  document.querySelectorAll(".playlist-item").forEach((el) =>
    el.classList.toggle("active", +el.dataset.id === id)
  );

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

// ─── Restore UI from current URL (used by init and popstate) ─────────────────
async function restoreFromUrl() {
  const params        = new URLSearchParams(location.search);
  const newSource     = ["porntubeai", "pmvhaven", "spankbang"].includes(params.get("source"))
    ? params.get("source") : "porntubeai";
  const savedVideo    = params.get("v") || null;
  const savedPlaylist = params.get("playlist") || null;

  if (newSource !== currentSource) {
    currentSource = newSource;
    currentId     = null;
    sbCurrentUrl  = SB_PLAYLISTS_URL;
    sbNextPageUrl = null;
    sbInSearch    = false;
    sbMode        = "playlists";
    SB_PLAYLISTS  = [];
    VIDEOS        = [];
    apiMode       = "playlists";
    document.querySelectorAll(".source-btn").forEach((b) =>
      b.classList.toggle("active", b.dataset.source === newSource)
    );
    sbSearchBar.classList.toggle("hidden", newSource !== "spankbang");
    browseHeader.classList.add("hidden");
    if (!playerView.classList.contains("hidden")) {
      playerView.classList.add("hidden");
      rightSidebar.classList.add("hidden");
      browseView.classList.remove("hidden");
      mainPlayer.pause();
      currentId = null;
    }
    await loadSource();
  }

  if (savedPlaylist) {
    if (newSource === "spankbang") {
      if (sbCurrentUrl !== savedPlaylist || sbMode !== "videos") {
        const title = savedPlaylist.replace(/\/$/, "").split("/").pop().replace(/-/g, " ");
        await openPlaylist(savedPlaylist, title);
      }
    } else {
      if (currentSort !== savedPlaylist || apiMode !== "videos") {
        const playlists = newSource === "pmvhaven" ? PMVH_PLAYLISTS : API_PLAYLISTS;
        const pl = playlists.find((p) => p.id === savedPlaylist);
        if (pl) await openApiPlaylist(pl.id, pl.title);
      }
    }
  } else if (!savedVideo) {
    if (newSource === "spankbang" && sbMode !== "playlists") {
      sbMode        = "playlists";
      sbInSearch    = false;
      sbNextPageUrl = null;
      sbCurrentUrl  = SB_PLAYLISTS_URL;
      if (SB_PLAYLISTS.length === 0) {
        SB_PLAYLISTS = await fetchSbPlaylists(SB_PLAYLISTS_URL);
      }
      renderPlaylists();
    } else if (newSource !== "spankbang" && apiMode !== "playlists") {
      apiMode = "playlists";
      renderApiPlaylists();
    }
  }

  if (!savedVideo) {
    if (!playerView.classList.contains("hidden")) {
      playerView.classList.add("hidden");
      rightSidebar.classList.add("hidden");
      browseView.classList.remove("hidden");
      mainPlayer.pause();
      currentId = null;
      relatedVideosList.innerHTML    = "";
      relatedPlaylistsList.innerHTML = "";
      switchSidebarTab("playlist");
    }
    return;
  }

  if (newSource === "spankbang") {
    const match = VIDEOS.find((v) => v.src === savedVideo);
    if (match) loadVideo(match.id);
    else playExternalVideo({ src: savedVideo, title: "", thumb: "" });
  } else {
    const match = VIDEOS.find((v) => videoSlug(v) === savedVideo);
    if (match) loadVideo(match.id);
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
(async function init() {
  restoringHistory = true;
  const params      = new URLSearchParams(location.search);
  const savedSource = ["porntubeai", "pmvhaven", "spankbang"].includes(params.get("source"))
    ? params.get("source") : "porntubeai";

  currentSource = savedSource;
  document.querySelectorAll(".source-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.source === savedSource)
  );
  sbSearchBar.classList.toggle("hidden", savedSource !== "spankbang");

  await loadSource();
  await restoreFromUrl();
  restoringHistory = false;
})();

// ─── Browser history navigation ───────────────────────────────────────────────
window.addEventListener("popstate", async () => {
  restoringHistory = true;
  try {
    await restoreFromUrl();
  } finally {
    restoringHistory = false;
  }
});
