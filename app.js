// ─── Config ──────────────────────────────────────────────────────────────────
const SOURCES = {
  porntubeai: "https://porntubeai.com/api/videos?limit=32&sort=",
  pmvhaven:   "https://pmvhaven.com/api/videos?limit=32&sort=",
};
const CORS_PROXY    = "https://api.codetabs.com/v1/proxy?quest=";
const SB_CORS_PROXY = "https://corsproxy.io/?";
const SB_PLAYLISTS_URL  = "https://spankbang.com/profile/das.thixxer/playlists";

const API_PLAYLISTS = [
  { id: "-views",          title: "Top Views",  desc: "Most viewed videos" },
  { id: "-bayesianRating", title: "Top Rated",  desc: "Highest rated videos" },
];

// ─── State ───────────────────────────────────────────────────────────────────
let currentSort          = "-views";
let currentSource        = "porntubeai";
let currentPlaylistTitle = "";
let VIDEOS               = [];
let currentId            = null;

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
const homeView         = document.getElementById("homeView");
const breadcrumbs      = document.getElementById("breadcrumbs");
const navSearch        = document.getElementById("navSearch");
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
const rightSidebar     = document.getElementById("rightSidebar");
const rightSidebarClose = document.getElementById("rightSidebarClose");
const sidebarShowBtn   = document.getElementById("sidebarShowBtn");
const relatedVideosList    = document.getElementById("relatedVideosList");
const relatedPlaylistsList = document.getElementById("relatedPlaylistsList");

// ─── Breadcrumbs ──────────────────────────────────────────────────────────────
const SOURCE_NAMES = { porntubeai: "PorntubeAI", pmvhaven: "PMV Haven", spankbang: "SpankBang" };

function renderBreadcrumbs() {
  const isHome    = !homeView.classList.contains("hidden");
  const isPlaying = !playerView.classList.contains("hidden");
  const inVideos  = currentSource === "spankbang" ? sbMode === "videos" : apiMode === "videos";
  const srcName   = SOURCE_NAMES[currentSource] || currentSource;

  let html = "";

  if (isHome) {
    html = `<span class="crumb logo active">Videx</span>`;
  } else if (!inVideos && !isPlaying) {
    html = `<button class="crumb logo" id="crumb0">Videx</button>
            <span class="crumb-sep">›</span>
            <span class="crumb active">${srcName}</span>`;
  } else {
    const plTitle = currentPlaylistTitle || "Playlist";
    html = `<button class="crumb logo" id="crumb0">Videx</button>
            <span class="crumb-sep">›</span>
            <button class="crumb" id="crumb1">${srcName}</button>
            <span class="crumb-sep">›</span>
            ${isPlaying
              ? `<button class="crumb" id="crumb2">${plTitle}</button>`
              : `<span class="crumb active">${plTitle}</span>`}`;
  }

  breadcrumbs.innerHTML = html;

  const c0 = document.getElementById("crumb0");
  const c1 = document.getElementById("crumb1");
  const c2 = document.getElementById("crumb2");
  if (c0) c0.addEventListener("click", goHome);
  if (c1) c1.addEventListener("click", goToSource);
  if (c2) c2.addEventListener("click", closePlayer);
}

// ─── Home view ────────────────────────────────────────────────────────────────
function showHomeView() {
  mainPlayer.pause();
  mainPlayer.src = "";
  mainPlayer.load();
  progressFill.style.width = "0%";
  playerView.classList.add("hidden");
  browseView.classList.add("hidden");
  rightSidebar.classList.add("hidden");
  sidebarShowBtn.classList.add("hidden");
  homeView.classList.remove("hidden");
  navSearch.classList.add("hidden");
  currentId            = null;
  currentPlaylistTitle = "";
  VIDEOS               = [];
  relatedVideosList.innerHTML    = "";
  relatedPlaylistsList.innerHTML = "";
  placeholder.classList.remove("hidden");
  document.querySelectorAll(".video-overlay").forEach((el) => el.classList.remove("visible"));
}

function goHome() {
  showHomeView();
  if (!restoringHistory) history.pushState(null, "", "?");
  renderBreadcrumbs();
}

// ─── Source switching ─────────────────────────────────────────────────────────
async function switchToSource(source) {
  currentSource        = source;
  currentId            = null;
  currentPlaylistTitle = "";
  sbCurrentUrl         = SB_PLAYLISTS_URL;
  sbNextPageUrl        = null;
  sbInSearch           = false;
  sbMode               = "playlists";
  SB_PLAYLISTS         = [];
  VIDEOS               = [];
  apiMode              = "playlists";

  homeView.classList.add("hidden");
  browseView.classList.remove("hidden");
  navSearch.classList.toggle("hidden", source !== "spankbang");

  if (!restoringHistory) history.pushState(null, "", "?source=" + source);
  renderBreadcrumbs();
  await loadSource();
}

document.querySelectorAll(".source-card").forEach((card) => {
  card.addEventListener("click", () => switchToSource(card.dataset.source));
});

// ─── Navigate back to source playlists from video list or player ──────────────
function goToSource() {
  if (!playerView.classList.contains("hidden")) {
    mainPlayer.pause();
    playerView.classList.add("hidden");
    rightSidebar.classList.add("hidden");
    sidebarShowBtn.classList.add("hidden");
    currentId = null;
    relatedVideosList.innerHTML = "";
    relatedPlaylistsList.innerHTML = "";
    switchSidebarTab("playlist");
    browseView.classList.remove("hidden");
  }
  currentPlaylistTitle = "";
  VIDEOS               = [];
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
  renderBreadcrumbs();
}

// ─── Player show / hide ───────────────────────────────────────────────────────
function openPlayer() {
  browseView.classList.add("hidden");
  playerView.classList.remove("hidden");
  rightSidebar.classList.add("hidden");
  rightSidebar.classList.toggle("sb-source", currentSource === "spankbang");
  sidebarShowBtn.classList.remove("hidden");
  switchSidebarTab("playlist");
  renderBreadcrumbs();
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
  renderBreadcrumbs();
}

mainPlayer.addEventListener("click", () => {
  if (mainPlayer.paused) mainPlayer.play().catch(() => {});
  else mainPlayer.pause();
});

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
  videoList.innerHTML    = "";
  playlistList.innerHTML = "";
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
  apiMode              = "videos";
  currentSort          = sortId;
  currentPage          = 1;
  currentPlaylistTitle = title;
  VIDEOS               = [];
  videoList.innerHTML  = `<li style="grid-column:1/-1;padding:2rem 1rem;color:var(--text-muted);font-size:.85rem;text-align:center;">Loading…</li>`;
  renderBreadcrumbs();
  VIDEOS = await fetchVideos(1);
  renderList();
  if (!restoringHistory) history.pushState(null, "", "?source=" + currentSource + "&playlist=" + encodeURIComponent(sortId));
}

// ─── Back to playlists (used by history restoration) ─────────────────────────
function goBackToPlaylists() {
  VIDEOS               = [];
  currentPlaylistTitle = "";
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
  renderBreadcrumbs();
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

// ─── Sync active highlights in grid and playlist sidebar ──────────────────────
function syncActiveItems() {
  document.querySelectorAll(".video-card").forEach((el) =>
    el.classList.toggle("active", +el.dataset.id === currentId)
  );
  document.querySelectorAll(".playlist-item").forEach((el) =>
    el.classList.toggle("active", +el.dataset.id === currentId)
  );
}

// ─── Play an API video directly from its URL (before playlist is loaded) ──────
function playDirectApiVideo(url) {
  mainPlayer.src    = url;
  mainPlayer.poster = "";
  mainPlayer.load();
  mainPlayer.play().catch(() => {});
  placeholder.classList.add("hidden");
  document.querySelectorAll(".video-overlay").forEach((el) => el.classList.add("visible"));
  videoTitle.textContent       = "";
  videoTitle.href              = url;
  videoViews.textContent       = "";
  videoDate.textContent        = "";
  videoDuration.textContent    = "";
  videoDescription.textContent = "";
  prevBtn.disabled = true;
  nextBtn.disabled = true;
  currentId = null;
  openPlayer();
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
      if (!res.ok) return;
      html = await res.text();
    } catch (err) {
      console.error("[sb] video page fetch failed:", err);
      return;
    }
    videoSrc = parseSpankBangVideoSrc(html);
    if (!videoSrc) return;

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
  if (!restoringHistory) history.pushState(null, "", "?source=" + currentSource + "&v=" + encodeURIComponent(v.src) + plParam);

  syncActiveItems();

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
  const sourceParam   = params.get("source");
  const newSource     = ["porntubeai", "pmvhaven", "spankbang"].includes(sourceParam)
    ? sourceParam : null;
  const savedVideo    = params.get("v") || null;
  const savedPlaylist = params.get("playlist") || null;

  if (!newSource) {
    showHomeView();
    renderBreadcrumbs();
    return;
  }

  // ── Switch source if it changed ────────────────────────────────────────────
  if (newSource !== currentSource) {
    currentSource        = newSource;
    currentId            = null;
    currentPlaylistTitle = "";
    sbCurrentUrl         = SB_PLAYLISTS_URL;
    sbNextPageUrl        = null;
    sbInSearch           = false;
    sbMode               = "playlists";
    SB_PLAYLISTS         = [];
    VIDEOS               = [];
    apiMode              = "playlists";
    navSearch.classList.toggle("hidden", newSource !== "spankbang");
    homeView.classList.add("hidden");
    browseView.classList.remove("hidden");
    if (!playerView.classList.contains("hidden")) {
      playerView.classList.add("hidden");
      rightSidebar.classList.add("hidden");
      browseView.classList.remove("hidden");
      mainPlayer.pause();
      currentId = null;
    }
    await loadSource();
  }

  // ── No video in URL → close player, show playlist or source home ───────────
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
    } else {
      if (newSource === "spankbang" && sbMode !== "playlists") {
        sbMode        = "playlists";
        sbInSearch    = false;
        sbNextPageUrl = null;
        sbCurrentUrl  = SB_PLAYLISTS_URL;
        currentPlaylistTitle = "";
        if (SB_PLAYLISTS.length === 0) SB_PLAYLISTS = await fetchSbPlaylists(SB_PLAYLISTS_URL);
        renderPlaylists();
      } else if (newSource !== "spankbang" && apiMode !== "playlists") {
        apiMode = "playlists";
        currentPlaylistTitle = "";
        renderApiPlaylists();
      }
    }
    renderBreadcrumbs();
    return;
  }

  // ── Video in URL ────────────────────────────────────────────────────────────
  const existingMatch = VIDEOS.find((v) => v.src === savedVideo);
  if (existingMatch) {
    loadVideo(existingMatch.id);
    renderBreadcrumbs();
    return;
  }

  if (newSource === "spankbang") {
    const playProm = playExternalVideo({ src: savedVideo, title: "", thumb: "" });

    if (savedPlaylist && (sbCurrentUrl !== savedPlaylist || sbMode !== "videos")) {
      const title = savedPlaylist.replace(/\/$/, "").split("/").pop().replace(/-/g, " ");
      await openPlaylist(savedPlaylist, title);
    }

    await playProm;

    const match = VIDEOS.find((v) => v.src === savedVideo);
    if (match) {
      currentId        = match.id;
      prevBtn.disabled = match.id <= 1;
      nextBtn.disabled = match.id >= VIDEOS.length;
    }
  } else {
    playDirectApiVideo(savedVideo);

    if (savedPlaylist) {
      const playlists = newSource === "pmvhaven" ? PMVH_PLAYLISTS : API_PLAYLISTS;
      const pl = playlists.find((p) => p.id === savedPlaylist);
      if (pl && (currentSort !== savedPlaylist || apiMode !== "videos")) {
        await openApiPlaylist(pl.id, pl.title);
      }
    }

    const match = VIDEOS.find((v) => v.src === savedVideo);
    if (match) {
      currentId                    = match.id;
      videoTitle.textContent       = match.title;
      videoTitle.href              = match.src;
      videoViews.textContent       = match.views ? `${match.views} views` : "";
      videoDuration.textContent    = match.duration;
      videoDescription.textContent = match.uploader ? `by ${match.uploader}` : "";
      prevBtn.disabled             = match.id <= 1;
      nextBtn.disabled             = false;
    }
  }

  if (currentId !== null) {
    syncActiveItems();
    const activePl = playlistList.querySelector(".playlist-item.active");
    if (activePl) activePl.scrollIntoView({ block: "nearest" });
  }

  renderBreadcrumbs();
}

// ─── Init ─────────────────────────────────────────────────────────────────────
(async function init() {
  restoringHistory = true;
  const params      = new URLSearchParams(location.search);
  const savedSource = ["porntubeai", "pmvhaven", "spankbang"].includes(params.get("source"))
    ? params.get("source") : null;

  if (!savedSource) {
    showHomeView();
    renderBreadcrumbs();
    restoringHistory = false;
    return;
  }

  currentSource = savedSource;
  homeView.classList.add("hidden");
  browseView.classList.remove("hidden");
  navSearch.classList.toggle("hidden", savedSource !== "spankbang");

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
