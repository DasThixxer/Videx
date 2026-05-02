import { state } from "./state.js";
import { loadVideo } from "./player.js";

const videoList    = document.getElementById("videoList");
const playlistList = document.getElementById("playlistList");

export function makeGridCard(v) {
  const li = document.createElement("li");
  li.className = "video-card" + (v.id === state.currentId ? " active" : "");
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

export function makePlaylistItem(v) {
  const li = document.createElement("li");
  li.className = "playlist-item" + (v.id === state.currentId ? " active" : "");
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

export function renderList() {
  videoList.innerHTML    = "";
  playlistList.innerHTML = "";
  if (state.VIDEOS.length === 0) {
    videoList.innerHTML = `<li style="grid-column:1/-1;padding:2rem 1rem;color:var(--text-muted);font-size:.85rem;text-align:center;">Loading…</li>`;
    return;
  }
  state.VIDEOS.forEach((v) => {
    videoList.appendChild(makeGridCard(v));
    playlistList.appendChild(makePlaylistItem(v));
  });
}

export function syncActiveItems() {
  document.querySelectorAll(".video-card").forEach((el) =>
    el.classList.toggle("active", +el.dataset.id === state.currentId)
  );
  document.querySelectorAll(".playlist-item").forEach((el) =>
    el.classList.toggle("active", +el.dataset.id === state.currentId)
  );
}
