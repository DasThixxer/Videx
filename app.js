// ─── Config ──────────────────────────────────────────────────────────────────
const SOURCES = {
  porntubeai: "https://porntubeai.com/api/videos?page=1&limit=32&sort=",
  pmvhaven:   "https://pmvhaven.com/api/videos?page=1&limit=32&sort=",
};
const CORS_PROXY    = "https://corsproxy.io/?url=";
const SB_SOURCE_URL = "https://spankbang.com/4tx1p/playlist/favorites/";

// ─── State ───────────────────────────────────────────────────────────────────
let currentSort   = "-views";
let currentSource = "porntubeai";
let VIDEOS        = [];
let currentId     = null;

let sbCurrentUrl  = SB_SOURCE_URL;
let sbNextPageUrl = null;
let sbLoadingMore = false;

// ─── DOM refs ────────────────────────────────────────────────────────────────
const sidebar          = document.getElementById("sidebar");
const sidebarBackdrop  = document.getElementById("sidebarBackdrop");
const sidebarClose     = document.getElementById("sidebarClose");
const menuBtn          = document.getElementById("menuBtn");
const sortToggle       = document.getElementById("sortToggle");
const sbSubTabs        = document.getElementById("sbSubTabs");
const videoList        = document.getElementById("videoList");
const relatedList      = document.getElementById("relatedList");
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

// ─── Source tabs ─────────────────────────────────────────────────────────────
document.querySelectorAll(".source-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    const source = tab.dataset.source;
    if (source === currentSource) return;

    document.querySelectorAll(".source-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    currentSource = source;
    currentId     = null;
    sbCurrentUrl  = SB_SOURCE_URL;
    sbNextPageUrl = null;
    VIDEOS        = [];

    const isSb = source === "spankbang";
    sortToggle.classList.toggle("hidden", isSb);
    sbSubTabs.classList.toggle("hidden", !isSb);
    if (isSb) switchSbPanel("videos");

    history.replaceState(null, "", "?source=" + source);
    renderList();
    loadSource();
  });
});

// ─── SpankBang sub-tabs ───────────────────────────────────────────────────────
function switchSbPanel(panel) {
  document.querySelectorAll("#sbSubTabs .sub-tab").forEach((t) =>
    t.classList.toggle("active", t.dataset.panel === panel)
  );
  videoList.classList.toggle("hidden", panel !== "videos");
  relatedList.classList.toggle("hidden", panel !== "related");
}

document.querySelectorAll("#sbSubTabs .sub-tab").forEach((tab) => {
  tab.addEventListener("click", () => switchSbPanel(tab.dataset.panel));
});

// ─── Load source ─────────────────────────────────────────────────────────────
async function loadSource() {
  if (currentSource === "spankbang") {
    VIDEOS = await fetchSpankBang(sbCurrentUrl);
  } else {
    VIDEOS = await fetchVideos();
  }
  renderList();
}

// ─── API fetch ────────────────────────────────────────────────────────────────
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

// ─── SpankBang: fetch & scrape playlist ──────────────────────────────────────
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

// ─── SpankBang: scrape related playlists from a video page ───────────────────
function scrapeRelated(doc) {
  const base      = new URL(sbCurrentUrl);
  const container = doc.querySelector("div.playlist-list");
  if (!container) return [];

  return Array.from(container.querySelectorAll("a[data-testid='playlist-item']")).map((a) => {
    const imgs  = Array.from(a.querySelectorAll("img")).slice(0, 4)
      .map((img) => img.getAttribute("src") || img.getAttribute("data-src") || "");
    const inf   = a.querySelector("p.inf");
    const title = inf?.textContent?.trim() || "Untitled";
    const href  = new URL(a.getAttribute("href") || "", base.origin).href;
    return { title, href, imgs };
  });
}

function renderRelated(items) {
  relatedList.innerHTML = "";
  if (items.length === 0) {
    relatedList.innerHTML = `<li style="padding:2rem 1rem;color:var(--text-muted);font-size:.85rem;text-align:center;">No related playlists found</li>`;
    return;
  }
  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "related-item";
    li.innerHTML = `
      <div class="related-cover">
        ${item.imgs.map((src) => `<img src="${src}" alt="" />`).join("")}
      </div>
      <div class="video-info">
        <div class="video-item-title">${item.title}</div>
      </div>
    `;
    li.addEventListener("click", () => {
      sbCurrentUrl  = item.href;
      sbNextPageUrl = null;
      VIDEOS        = [];
      switchSbPanel("videos");
      renderList();
      fetchSpankBang(item.href).then((items) => { VIDEOS = items; renderList(); });
    });
    relatedList.appendChild(li);
  });
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

// ─── Infinite scroll: load next SpankBang page ───────────────────────────────
videoList.addEventListener("scroll", () => {
  if (currentSource !== "spankbang" || !sbNextPageUrl || sbLoadingMore) return;
  const { scrollTop, scrollHeight, clientHeight } = videoList;
  if (scrollHeight - scrollTop - clientHeight < 200) loadMoreSpankBang();
});

async function loadMoreSpankBang() {
  sbLoadingMore = true;
  const newItems = await fetchSpankBang(sbNextPageUrl, true);
  VIDEOS.push(...newItems);
  newItems.forEach((v) => videoList.appendChild(makeVideoItem(v)));
  sbLoadingMore = false;
}

// ─── Render sidebar list ──────────────────────────────────────────────────────
function makeVideoItem(v) {
  const li = document.createElement("li");
  li.className = "video-item" + (v.id === currentId ? " active" : "");
  li.dataset.id = v.id;
  li.innerHTML = `
    <div class="video-thumb">
      ${v.thumb ? `<img src="${v.thumb}" alt="" loading="lazy" />` : ""}
      ${v.duration ? `<span class="duration-badge">${v.duration}</span>` : ""}
    </div>
    <div class="video-info">
      <div class="video-item-title">${v.title}</div>
      <div class="video-item-meta">${v.uploader}${v.views ? ` &middot; ${v.views} views` : ""}</div>
    </div>
  `;
  li.addEventListener("click", () => loadVideo(v.id));
  return li;
}

function renderList() {
  videoList.innerHTML = "";
  if (VIDEOS.length === 0) {
    videoList.innerHTML = `<li style="padding:1rem;color:var(--text-muted);font-size:.85rem;">Loading...</li>`;
    return;
  }
  VIDEOS.forEach((v) => videoList.appendChild(makeVideoItem(v)));
}

// ─── Load a video ─────────────────────────────────────────────────────────────
async function loadVideo(id) {
  const v = VIDEOS.find((x) => x.id === id);
  if (!v) return;
  currentId = id;

  let videoSrc = v.src;

  if (currentSource === "spankbang" && v.src) {
    const pageUrl = new URL(v.src, "https://spankbang.com").href;
    let html;
    try {
      const res = await fetch(pageUrl);
      html = await res.text();
    } catch (err) {
      console.error("[sb] video page fetch failed:", err);
      return;
    }
    videoSrc = parseSpankBangVideoSrc(html);
    if (!videoSrc) { console.warn("[sb] no video src found"); return; }

    // Scrape and show related playlists in the Related panel
    const doc     = new DOMParser().parseFromString(html, "text/html");
    const related = scrapeRelated(doc);
    renderRelated(related);
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
  nextBtn.disabled = v.id >= VIDEOS.length;
  history.replaceState(null, "", "?source=" + currentSource + "#" + v.id);
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

// ─── Sort toggle (API sources only) ──────────────────────────────────────────
document.querySelectorAll("#sortToggle .sub-tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.sort === currentSort) return;
    currentSort = btn.dataset.sort;
    document.querySelectorAll("#sortToggle .sub-tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    VIDEOS = [];
    renderList();
    fetchVideos().then((videos) => { VIDEOS = videos; renderList(); });
  });
});

// ─── Init ─────────────────────────────────────────────────────────────────────
(function init() {
  const params      = new URLSearchParams(location.search);
  const savedSource = params.get("source") || "porntubeai";

  if (savedSource !== currentSource) {
    currentSource = savedSource;
    document.querySelectorAll(".source-tab").forEach((t) =>
      t.classList.toggle("active", t.dataset.source === savedSource)
    );
    const isSb = savedSource === "spankbang";
    sortToggle.classList.toggle("hidden", isSb);
    sbSubTabs.classList.toggle("hidden", !isSb);
    if (isSb) switchSbPanel("videos");
  }

  renderList();
  loadSource().then(() => {
    const hash = parseInt(location.hash.slice(1));
    if (hash) loadVideo(hash);
  });
})();
