import { SOURCE_NAMES, API_PLAYLISTS, SB_PLAYLISTS_URL } from "./config.js";
import { state } from "./state.js";
import { PMVH_PLAYLISTS } from "./pmvhaven.js";
import { renderList } from "./render.js";
import { fetchVideos, loadMoreApiVideos } from "./api.js";
import { fetchSbPlaylists, renderPlaylists, loadMoreSpankBang } from "./spankbang.js";
import { GRID_PROFILES, initGridDOM, startGridProfile, stopGridLanes } from "./grid.js";

const homeView         = document.getElementById("homeView");
const breadcrumbs      = document.getElementById("breadcrumbs");
const navSearch        = document.getElementById("navSearch");
const browseView       = document.getElementById("browseView");
const playerView       = document.getElementById("playerView");
const gridView         = document.getElementById("gridView");
const mainPlayer       = document.getElementById("mainPlayer");
const progressBar      = document.getElementById("progressBar");
const progressFill     = document.getElementById("progressFill");
const placeholder      = document.getElementById("playerPlaceholder");
const videoList        = document.getElementById("videoList");
const playlistList     = document.getElementById("playlistList");
const relatedVideosList    = document.getElementById("relatedVideosList");
const relatedPlaylistsList = document.getElementById("relatedPlaylistsList");
const rightSidebar     = document.getElementById("rightSidebar");
const rightSidebarClose = document.getElementById("rightSidebarClose");
const sidebarShowBtn   = document.getElementById("sidebarShowBtn");

// ─── Breadcrumbs ──────────────────────────────────────────────────────────────

export function renderBreadcrumbs() {
  const isHome    = !homeView.classList.contains("hidden");
  const isGrid    = !gridView.classList.contains("hidden");
  const isPlaying = !playerView.classList.contains("hidden");
  const inVideos  = state.currentSource === "spankbang" ? state.sbMode === "videos" : state.apiMode === "videos";
  const srcName   = SOURCE_NAMES[state.currentSource] || state.currentSource;

  let html = "";

  if (isHome) {
    html = `<span class="crumb logo active">Videx</span>`;
  } else if (isGrid) {
    html = `<button class="crumb logo" id="crumb0">Videx</button>
            <span class="crumb-sep">›</span>
            <span class="crumb active">Grid View</span>`;
  } else if (!inVideos && !isPlaying) {
    html = `<button class="crumb logo" id="crumb0">Videx</button>
            <span class="crumb-sep">›</span>
            <span class="crumb active">${srcName}</span>`;
  } else {
    const plTitle = state.currentPlaylistTitle || "Playlist";
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

export function showHomeView() {
  mainPlayer.pause();
  mainPlayer.src = "";
  mainPlayer.load();
  progressFill.style.width = "0%";
  progressBar.classList.remove("hidden");
  playerView.classList.add("hidden");
  browseView.classList.add("hidden");
  gridView.classList.add("hidden");
  stopGridLanes();
  rightSidebar.classList.add("hidden");
  sidebarShowBtn.classList.add("hidden");
  homeView.classList.remove("hidden");
  navSearch.classList.add("hidden");
  state.currentId            = null;
  state.currentPlaylistTitle = "";
  state.VIDEOS               = [];
  relatedVideosList.innerHTML    = "";
  relatedPlaylistsList.innerHTML = "";
  placeholder.classList.remove("hidden");
  document.querySelectorAll(".video-overlay").forEach((el) => el.classList.remove("visible"));
}

export function goHome() {
  showHomeView();
  renderBreadcrumbs();
}

// ─── Grid view ────────────────────────────────────────────────────────────────

export function renderHomeGridProfiles() {
  const container = document.getElementById("gridProfileCards");
  container.innerHTML = "";
  const svgIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="9" height="18" rx="1"/><rect x="13" y="3" width="9" height="18" rx="1"/></svg>`;
  GRID_PROFILES.forEach((p, i) => {
    const card = document.createElement("div");
    card.className = "grid-view-card";
    card.innerHTML = `<div class="grid-view-card-icon">${svgIcon}</div><div><div class="grid-view-card-name">Grid · ${p.name}</div><div class="grid-view-card-desc">${p.lanes.map(l => l.label.split(" · ")[0]).join(" / ")}</div></div>`;
    card.addEventListener("click", () => showGridView(i));
    container.appendChild(card);
  });
}

export function showGridView(profileIndex = 0) {
  homeView.classList.add("hidden");
  browseView.classList.add("hidden");
  playerView.classList.add("hidden");
  rightSidebar.classList.add("hidden");
  sidebarShowBtn.classList.add("hidden");
  navSearch.classList.add("hidden");
  progressBar.classList.add("hidden");
  gridView.classList.remove("hidden");
  renderBreadcrumbs();
  startGridProfile(GRID_PROFILES[profileIndex]);
}

// ─── Player show / hide ───────────────────────────────────────────────────────

export function openPlayer() {
  browseView.classList.add("hidden");
  playerView.classList.remove("hidden");
  rightSidebar.classList.add("hidden");
  rightSidebar.classList.toggle("sb-source", state.currentSource === "spankbang");
  sidebarShowBtn.classList.remove("hidden");
  switchSidebarTab("playlist");
  renderBreadcrumbs();
}

export function closePlayer() {
  playerView.classList.add("hidden");
  rightSidebar.classList.add("hidden");
  sidebarShowBtn.classList.add("hidden");
  browseView.classList.remove("hidden");
  mainPlayer.pause();
  state.currentId = null;
  relatedVideosList.innerHTML    = "";
  relatedPlaylistsList.innerHTML = "";
  switchSidebarTab("playlist");
  renderList();
  renderBreadcrumbs();
}

// ─── Right sidebar tab switching ──────────────────────────────────────────────

export function switchSidebarTab(tab) {
  document.querySelectorAll(".sidebar-tab").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === tab)
  );
  document.querySelectorAll(".sidebar-list").forEach((el) =>
    el.classList.toggle("active", el.dataset.tab === tab)
  );
}

// ─── Source switching ─────────────────────────────────────────────────────────

export async function switchToSource(source) {
  state.currentSource        = source;
  state.currentId            = null;
  state.currentPlaylistTitle = "";
  state.sbCurrentUrl         = SB_PLAYLISTS_URL;
  state.sbNextPageUrl        = null;
  state.sbInSearch           = false;
  state.sbMode               = "playlists";
  state.SB_PLAYLISTS         = [];
  state.VIDEOS               = [];
  state.apiMode              = "playlists";

  homeView.classList.add("hidden");
  browseView.classList.remove("hidden");
  navSearch.classList.toggle("hidden", source !== "spankbang");

  renderBreadcrumbs();
  await loadSource();
}

export function goToSource() {
  if (!playerView.classList.contains("hidden")) {
    mainPlayer.pause();
    playerView.classList.add("hidden");
    rightSidebar.classList.add("hidden");
    sidebarShowBtn.classList.add("hidden");
    state.currentId = null;
    relatedVideosList.innerHTML    = "";
    relatedPlaylistsList.innerHTML = "";
    switchSidebarTab("playlist");
    browseView.classList.remove("hidden");
  }
  state.currentPlaylistTitle = "";
  state.VIDEOS               = [];
  browseView.scrollTop       = 0;
  if (state.currentSource === "spankbang") {
    state.sbMode        = "playlists";
    state.sbInSearch    = false;
    state.sbNextPageUrl = null;
    renderPlaylists();
  } else {
    state.apiMode = "playlists";
    renderApiPlaylists();
  }
  renderBreadcrumbs();
}

export function goBackToPlaylists() {
  state.VIDEOS               = [];
  state.currentPlaylistTitle = "";
  browseView.scrollTop       = 0;
  if (state.currentSource === "spankbang") {
    state.sbMode        = "playlists";
    state.sbInSearch    = false;
    state.sbNextPageUrl = null;
    renderPlaylists();
  } else {
    state.apiMode = "playlists";
    renderApiPlaylists();
  }
  renderBreadcrumbs();
}

// ─── Load source ──────────────────────────────────────────────────────────────

export async function loadSource() {
  if (state.currentSource === "spankbang") {
    state.sbMode      = "playlists";
    state.SB_PLAYLISTS = await fetchSbPlaylists(SB_PLAYLISTS_URL);
    renderPlaylists();
  } else {
    state.apiMode = "playlists";
    renderApiPlaylists();
  }
}

// ─── API: render sort-as-playlist cards ───────────────────────────────────────

export function renderApiPlaylists() {
  videoList.innerHTML    = "";
  playlistList.innerHTML = "";
  const playlists = state.currentSource === "pmvhaven" ? PMVH_PLAYLISTS : API_PLAYLISTS;
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

export async function openApiPlaylist(sortId, title) {
  state.apiMode              = "videos";
  state.currentSort          = sortId;
  state.currentPage          = 1;
  state.currentPlaylistTitle = title;
  state.VIDEOS               = [];
  videoList.innerHTML = `<li style="grid-column:1/-1;padding:2rem 1rem;color:var(--text-muted);font-size:.85rem;text-align:center;">Loading…</li>`;
  renderBreadcrumbs();
  state.VIDEOS = await fetchVideos(1);
  renderList();
}

// ─── Infinite scroll ──────────────────────────────────────────────────────────

browseView.addEventListener("scroll", () => {
  const { scrollTop, scrollHeight, clientHeight } = browseView;
  if (scrollHeight - scrollTop - clientHeight >= 200) return;
  if (state.currentSource === "spankbang") {
    if (state.sbMode === "videos" && state.sbNextPageUrl && !state.sbLoadingMore) loadMoreSpankBang();
  } else {
    if (state.apiMode === "videos" && !state.apiLoadingMore) loadMoreApiVideos();
  }
});

// ─── Sidebar close / open ─────────────────────────────────────────────────────

rightSidebarClose.addEventListener("click", () => {
  rightSidebar.classList.add("hidden");
  sidebarShowBtn.classList.remove("hidden");
});
sidebarShowBtn.addEventListener("click", () => {
  rightSidebar.classList.remove("hidden");
  sidebarShowBtn.classList.add("hidden");
});

// ─── Source card clicks ───────────────────────────────────────────────────────

document.querySelectorAll(".source-card").forEach((card) => {
  card.addEventListener("click", () => switchToSource(card.dataset.source));
});

// ─── Sidebar tab clicks ───────────────────────────────────────────────────────

document.querySelectorAll(".sidebar-tab").forEach((btn) => {
  btn.addEventListener("click", () => switchSidebarTab(btn.dataset.tab));
});
