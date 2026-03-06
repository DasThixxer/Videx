// ─── Config ──────────────────────────────────────────────────────────────────
const SOURCES = {
  porntubeai: "https://porntubeai.com/api/videos?page=1&limit=32&sort=",
  pmvhaven:   "https://pmvhaven.com/api/videos?page=1&limit=32&sort=",
};
const CORS_PROXY  = "https://corsproxy.io/?url=";
let currentSort   = "-views";
let currentSource = "porntubeai";

// ─── Fetch videos from API ───────────────────────────────────────────────────
async function fetchVideos() {
  try {
    const res  = await fetch(CORS_PROXY + encodeURIComponent(SOURCES[currentSource] + currentSort));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return (json.videos || json.data || []).map((v, i) => ({
      id:       i + 1,
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

// ─── State ───────────────────────────────────────────────────────────────────
let VIDEOS    = [];
let currentId = null;

// ─── DOM refs ────────────────────────────────────────────────────────────────
const sidebar          = document.getElementById("sidebar");
const sidebarBackdrop  = document.getElementById("sidebarBackdrop");
const sidebarClose     = document.getElementById("sidebarClose");
const menuBtn          = document.getElementById("menuBtn");
const videoList        = document.getElementById("videoList");
const mainPlayer       = document.getElementById("mainPlayer");
const placeholder      = document.getElementById("playerPlaceholder");
const videoTitle       = document.getElementById("videoTitle");
const videoViews       = document.getElementById("videoViews");
const videoDate        = document.getElementById("videoDate");
const videoDuration    = document.getElementById("videoDuration");
const videoDescription = document.getElementById("videoDescription");
const videoOverlay     = document.getElementById("videoOverlay");
const progressBar      = document.getElementById("progressBar");
const progressFill     = document.getElementById("progressFill");
const prevBtn          = document.getElementById("prevBtn");
const nextBtn          = document.getElementById("nextBtn");

// ─── Sidebar toggle ──────────────────────────────────────────────────────────
function openSidebar() {
  sidebar.classList.add("open");
  sidebarBackdrop.classList.add("active");
}

function closeSidebar() {
  sidebar.classList.remove("open");
  sidebarBackdrop.classList.remove("active");
}

menuBtn.addEventListener("click", openSidebar);
sidebarClose.addEventListener("click", closeSidebar);
sidebarBackdrop.addEventListener("click", closeSidebar);

// ─── Render sidebar list ──────────────────────────────────────────────────────
function renderList() {
  videoList.innerHTML = "";

  if (VIDEOS.length === 0) {
    videoList.innerHTML = `<li style="padding:1rem;color:var(--text-muted);font-size:.85rem;">Loading...</li>`;
    return;
  }

  VIDEOS.forEach((v) => {
    const li = document.createElement("li");
    li.className = "video-item" + (v.id === currentId ? " active" : "");
    li.dataset.id = v.id;
    li.innerHTML = `
      <div class="video-thumb">
        <img src="${v.thumb}" alt="" loading="lazy" />
        ${v.duration ? `<span class="duration-badge">${v.duration}</span>` : ""}
      </div>
      <div class="video-info">
        <div class="video-item-title">${v.title}</div>
        <div class="video-item-meta">${v.uploader}${v.views ? ` &middot; ${v.views} views` : ""}</div>
      </div>
    `;
    li.addEventListener("click", () => loadVideo(v.id));
    videoList.appendChild(li);
  });
}

// ─── Load a video ─────────────────────────────────────────────────────────────
function loadVideo(id) {
  const v = VIDEOS.find((x) => x.id === id);
  if (!v) return;
  currentId = id;

  mainPlayer.src    = v.src;
  mainPlayer.poster = v.thumb;
  mainPlayer.load();
  mainPlayer.play().catch(() => {});
  placeholder.classList.add("hidden");
  document.querySelectorAll(".video-overlay").forEach(el => el.classList.add("visible"));

  videoTitle.textContent    = v.title;
  videoViews.textContent    = v.views ? `${v.views} views` : "";
  videoDate.textContent     = "";
  videoDuration.textContent = v.duration;
  videoDescription.textContent = v.uploader ? `by ${v.uploader}` : "";

  prevBtn.disabled = v.id <= 1;
  nextBtn.disabled = v.id >= VIDEOS.length;
  history.replaceState(null, "", "#" + v.id);
  renderList();
  closeSidebar();
}

prevBtn.addEventListener("click", () => { if (currentId > 1) loadVideo(currentId - 1); });
nextBtn.addEventListener("click", () => { if (currentId < VIDEOS.length) loadVideo(currentId + 1); });

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
  if (currentId < VIDEOS.length) loadVideo(currentId + 1);
});

// ─── Scroll to seek ───────────────────────────────────────────────────────────
mainPlayer.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (!mainPlayer.duration) return;
  const step = mainPlayer.duration / 10;
  mainPlayer.currentTime = Math.min(mainPlayer.duration,
    Math.max(0, mainPlayer.currentTime + (e.deltaY > 0 ? step : -step)));
}, { passive: false });

// ─── Source tabs ─────────────────────────────────────────────────────────────
document.querySelectorAll(".source-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.dataset.source === currentSource) return;
    currentSource = tab.dataset.source;
    document.querySelectorAll(".source-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    VIDEOS = [];
    currentId = null;
    renderList();
    fetchVideos().then((videos) => { VIDEOS = videos; renderList(); });
  });
});

// ─── Sort toggle ─────────────────────────────────────────────────────────────
document.querySelectorAll(".sort-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.sort === currentSort) return;
    currentSort = btn.dataset.sort;
    document.querySelectorAll(".sort-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    VIDEOS = [];
    renderList();
    fetchVideos().then((videos) => { VIDEOS = videos; renderList(); });
  });
});

// ─── Init ─────────────────────────────────────────────────────────────────────
renderList();
fetchVideos().then((videos) => {
  VIDEOS = videos;
  renderList();
  const hash = parseInt(window.location.hash.slice(1));
  if (hash) loadVideo(hash);
});
