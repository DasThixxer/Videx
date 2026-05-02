import { SOURCES, CORS_PROXY } from "./config.js";
import { state } from "./state.js";
import { makeGridCard, makePlaylistItem } from "./render.js";

const videoList    = document.getElementById("videoList");
const playlistList = document.getElementById("playlistList");

export async function fetchVideos(page = 1, append = false) {
  try {
    const url    = SOURCES[state.currentSource] + state.currentSort + "&page=" + page;
    const res    = await fetch(CORS_PROXY + encodeURIComponent(url));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json   = await res.json();
    const offset = append ? state.VIDEOS.length : 0;
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

export async function loadMoreApiVideos() {
  if (state.apiLoadingMore) return [];
  state.apiLoadingMore = true;
  const newItems = await fetchVideos(++state.currentPage, true);
  state.VIDEOS.push(...newItems);
  newItems.forEach((v) => {
    videoList.appendChild(makeGridCard(v));
    playlistList.appendChild(makePlaylistItem(v));
  });
  state.apiLoadingMore = false;
  return newItems;
}
