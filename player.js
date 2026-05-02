import { state } from "./state.js";
import { renderList, makeGridCard, makePlaylistItem, syncActiveItems } from "./render.js";
import { loadMoreApiVideos } from "./api.js";
import {
  parseSpankBangVideoSrc,
  scrapeRelatedVideos, scrapeRelatedPlaylists,
  renderRelatedVideos, renderRelatedPlaylists,
} from "./spankbang.js";
import { openPlayer } from "./nav.js";

const mainPlayer       = document.getElementById("mainPlayer");
const progressBar      = document.getElementById("progressBar");
const progressFill     = document.getElementById("progressFill");
const playlistList     = document.getElementById("playlistList");
const placeholder      = document.getElementById("playerPlaceholder");
const videoTitle       = document.getElementById("videoTitle");
const videoViews       = document.getElementById("videoViews");
const videoDate        = document.getElementById("videoDate");
const videoDuration    = document.getElementById("videoDuration");
const videoDescription = document.getElementById("videoDescription");
const prevBtn          = document.getElementById("prevBtn");
const nextBtn          = document.getElementById("nextBtn");
const seekBackBtn      = document.getElementById("seekBackBtn");
const seekForwardBtn   = document.getElementById("seekForwardBtn");
const relatedVideosList    = document.getElementById("relatedVideosList");
const relatedPlaylistsList = document.getElementById("relatedPlaylistsList");

export async function loadVideo(id) {
  const v = state.VIDEOS.find((x) => x.id === id);
  if (!v) return;
  state.currentId = id;

  let videoSrc = v.src;

  if (state.currentSource === "spankbang" && v.src) {
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
  videoTitle.href        = state.currentSource === "spankbang"
    ? new URL(v.src, "https://spankbang.com").href
    : v.src;
  videoViews.textContent       = v.views ? `${v.views} views` : "";
  videoDate.textContent        = "";
  videoDuration.textContent    = v.duration;
  videoDescription.textContent = v.uploader ? `by ${v.uploader}` : "";

  prevBtn.disabled = v.id <= 1;
  nextBtn.disabled = state.currentSource === "spankbang" && v.id >= state.VIDEOS.length;

  syncActiveItems();

  const activePl = playlistList.querySelector(".playlist-item.active");
  if (activePl) activePl.scrollIntoView({ block: "nearest" });

  openPlayer();
}

export function playDirectApiVideo(url) {
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
  state.currentId  = null;
  openPlayer();
}

// ─── Playback controls ────────────────────────────────────────────────────────

mainPlayer.addEventListener("click", () => {
  if (mainPlayer.paused) mainPlayer.play().catch(() => {});
  else mainPlayer.pause();
});

prevBtn.addEventListener("click", () => {
  if (state.currentId > 1) loadVideo(state.currentId - 1);
});

nextBtn.addEventListener("click", () => {
  if (state.currentId < state.VIDEOS.length) {
    loadVideo(state.currentId + 1);
  } else if (state.currentSource !== "spankbang") {
    loadMoreApiVideos().then((items) => { if (items.length) loadVideo(state.currentId + 1); });
  }
});

seekBackBtn.addEventListener("click", () => {
  if (!mainPlayer.duration) return;
  mainPlayer.currentTime = Math.max(0, mainPlayer.currentTime - mainPlayer.duration / 10);
});

seekForwardBtn.addEventListener("click", () => {
  if (!mainPlayer.duration) return;
  mainPlayer.currentTime = Math.min(mainPlayer.duration, mainPlayer.currentTime + mainPlayer.duration / 10);
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
  if (state.currentId < state.VIDEOS.length) {
    loadVideo(state.currentId + 1);
  } else if (state.currentSource !== "spankbang") {
    loadMoreApiVideos().then((items) => { if (items.length) loadVideo(state.currentId + 1); });
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
