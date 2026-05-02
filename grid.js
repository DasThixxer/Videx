// ─── Grid profiles ────────────────────────────────────────────────────────────
const GRID_PROFILES = [
  {
    name: "Default",
    lanes: [
      { source: "porntubeai", sort: "-bayesianRating", playlistSearch: null,         label: "PorntubeAI · Top Rated", muted: true,  enabled: true  },
      { source: "spankbang",  sort: null,              playlistSearch: "favorites",  label: "SpankBang · Favourites", muted: false, enabled: true  },
      { source: "pmvhaven",   sort: "-bayesianRating", playlistSearch: null,         label: "PMV Haven · Top Rated",  muted: true,  enabled: true  },
    ]
  },
  {
    name: "Blowjob",
    lanes: [
      { source: "porntubeai", sort: "-bayesianRating", playlistSearch: null,        label: "PorntubeAI · Top Rated", muted: true,  enabled: true  },
      { source: "spankbang",  sort: null,              playlistSearch: "blowjob",   label: "SpankBang · Blowjob",    muted: false, enabled: true  },
      { source: "pmvhaven",   sort: "-bayesianRating", playlistSearch: null,        label: "PMV Haven · Top Rated",  muted: true,  enabled: true  },
    ]
  },
];

// ─── Lane runtime state ───────────────────────────────────────────────────────
const gridLanes = [0, 1, 2].map(i => ({
  index:        i,
  source:       null,
  sort:         null,
  playlistUrl:  null,
  videos:       [],
  currentId:    null,
  page:         1,
  nextPageUrl:  null,
  loadingMore:  false,
  enabled:      true,
  profileMuted: true,
  player:       null,
  titleEl:      null,
  progressFill: null,
  progressBar:  null,
  prevBtn:      null,
  nextBtn:      null,
  headerEl:     null,
}));

// ─── Wire up DOM refs and event listeners (called once on init) ───────────────
function initGridDOM() {
  [0, 1, 2].forEach(i => {
    const lane = gridLanes[i];
    lane.player       = document.getElementById(`gridPlayer${i}`);
    lane.titleEl      = document.getElementById(`gridTitle${i}`);
    lane.progressFill = document.getElementById(`gridProgressFill${i}`);
    lane.progressBar  = document.getElementById(`gridProgressBar${i}`);
    lane.prevBtn      = document.getElementById(`gridPrev${i}`);
    lane.nextBtn      = document.getElementById(`gridNext${i}`);
    lane.headerEl     = document.getElementById(`gridHeader${i}`);

    lane.player.addEventListener("click", () => {
      if (lane.player.paused) lane.player.play().catch(() => {});
      else lane.player.pause();
    });

    lane.player.addEventListener("timeupdate", () => {
      if (!lane.player.duration) return;
      lane.progressFill.style.width =
        (lane.player.currentTime / lane.player.duration * 100) + "%";
    });

    lane.player.addEventListener("ended", () => gridAutoNext(i));

    lane.player.addEventListener("wheel", e => {
      e.preventDefault();
      if (!lane.player.duration) return;
      const step = lane.player.duration / 10;
      lane.player.currentTime = Math.min(lane.player.duration,
        Math.max(0, lane.player.currentTime + (e.deltaY > 0 ? step : -step)));
    }, { passive: false });

    lane.progressBar.addEventListener("click", e => {
      if (!lane.player.duration) return;
      lane.player.currentTime =
        (e.offsetX / lane.progressBar.offsetWidth) * lane.player.duration;
    });

    lane.prevBtn.addEventListener("click", () => {
      if (lane.currentId && lane.currentId > 1) gridLoadVideo(i, lane.currentId - 1);
    });
    lane.nextBtn.addEventListener("click", () => gridAutoNext(i));
  });
}

// ─── Fetch helpers (parameterized — no global state side effects) ─────────────
async function fetchVideosForLane(source, sort, page, offset = 0) {
  try {
    const url = SOURCES[source] + sort + "&page=" + page;
    const res = await fetch(CORS_PROXY + encodeURIComponent(url));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return (json.videos || json.data || []).map((v, i) => ({
      id:       offset + i + 1,
      title:    v.title,
      src:      v.videoUrl,
      thumb:    v.thumbnailUrl,
      duration: v.duration  || "",
      views:    v.views ? v.views.toLocaleString() : "",
      uploader: v.uploader  || "",
    }));
  } catch (err) {
    console.error("[grid] api fetch failed:", err);
    return [];
  }
}

async function fetchSbForLane(url, offset) {
  try {
    const res   = await fetch(url);
    const html  = await res.text();
    const doc   = new DOMParser().parseFromString(html, "text/html");
    const root  = doc.querySelector('[data-testid="main"]') ?? doc;
    const nodes = root.querySelectorAll('[data-testid="video-item"]');
    const nextEl = doc.querySelector(".pagination li.next a[href]");
    const nextPageUrl = nextEl
      ? new URL(nextEl.getAttribute("href"), "https://spankbang.com").href
      : null;
    const videos = Array.from(nodes).map((node, i) => {
      const a        = node.querySelector("a[href]");
      const titleA   = node.querySelector("a[title]");
      const img      = node.querySelector("img");
      const duration = node.querySelector("[data-testid='video-item-length']");
      return {
        id:       offset + i + 1,
        title:    titleA?.getAttribute("title") || img?.getAttribute("alt") || "Video",
        src:      a?.getAttribute("href") || "",
        thumb:    img?.getAttribute("src") || img?.getAttribute("data-src") || "",
        duration: duration?.textContent?.trim() || "",
        views:    "",
        uploader: "",
      };
    }).filter(v => v.src.startsWith("/"));
    return { videos, nextPageUrl };
  } catch (err) {
    console.error("[grid] sb fetch failed:", err);
    return { videos: [], nextPageUrl: null };
  }
}

// ─── Load a video into a lane ─────────────────────────────────────────────────
async function gridLoadVideo(laneIndex, id) {
  const lane = gridLanes[laneIndex];
  const v = lane.videos.find(x => x.id === id);
  if (!v) return;
  lane.currentId = id;

  let src = v.src;

  if (lane.source === "spankbang" && v.src) {
    const pageUrl = new URL(v.src, "https://spankbang.com").href;
    try {
      const res = await fetch(pageUrl);
      if (!res.ok) return;
      src = parseSpankBangVideoSrc(await res.text());
      if (!src) return;
    } catch { return; }
  }

  lane.player.src    = src;
  lane.player.poster = v.thumb;
  lane.player.muted  = lane.profileMuted;
  lane.player.load();
  lane.player.play().catch(() => {});

  lane.titleEl.textContent = v.title;
  lane.titleEl.href = lane.source === "spankbang"
    ? new URL(v.src, "https://spankbang.com").href
    : v.src;

  lane.prevBtn.disabled = v.id <= 1;
  lane.nextBtn.disabled = false;
  lane.progressFill.style.width = "0%";
}

// ─── Auto-advance to next video ───────────────────────────────────────────────
async function gridAutoNext(laneIndex) {
  const lane = gridLanes[laneIndex];
  if (!lane.enabled) return;
  const nextId = (lane.currentId || 0) + 1;

  if (nextId <= lane.videos.length) {
    gridLoadVideo(laneIndex, nextId);
    return;
  }

  if (lane.loadingMore) return;
  lane.loadingMore = true;

  if (lane.source === "spankbang") {
    if (!lane.nextPageUrl) { lane.loadingMore = false; return; }
    const result = await fetchSbForLane(lane.nextPageUrl, lane.videos.length);
    lane.videos.push(...result.videos);
    lane.nextPageUrl = result.nextPageUrl;
  } else {
    lane.page++;
    const more = await fetchVideosForLane(lane.source, lane.sort, lane.page, lane.videos.length);
    lane.videos.push(...more);
  }

  lane.loadingMore = false;
  if (nextId <= lane.videos.length) gridLoadVideo(laneIndex, nextId);
}

// ─── Stop all grid players ────────────────────────────────────────────────────
function stopGridLanes() {
  gridLanes.forEach(lane => {
    if (lane.player) {
      lane.player.pause();
      lane.player.src = "";
      lane.player.load();
    }
    if (lane.progressFill) lane.progressFill.style.width = "0%";
  });
}

// ─── Start a grid profile (loads all 3 lanes in parallel) ────────────────────
async function startGridProfile(profile) {
  await Promise.all([0, 1, 2].map(async i => {
    const cfg  = profile.lanes[i];
    const lane = gridLanes[i];

    // Reset lane state
    lane.source       = cfg.source;
    lane.sort         = cfg.sort;
    lane.enabled      = cfg.enabled !== false;
    lane.profileMuted = cfg.muted !== false;
    lane.playlistUrl  = null;
    lane.videos       = [];
    lane.currentId    = null;
    lane.page         = 1;
    lane.nextPageUrl  = null;
    lane.loadingMore  = false;

    lane.player.pause();
    lane.player.src   = "";
    lane.player.muted = true;
    lane.player.load();
    lane.progressFill.style.width = "0%";
    lane.prevBtn.disabled = true;
    lane.nextBtn.disabled = true;
    lane.headerEl.textContent = cfg.label;
    lane.headerEl.style.opacity = lane.enabled ? "" : "0.4";

    if (!lane.enabled) {
      lane.titleEl.textContent = "";
      lane.titleEl.href        = "";
      return;
    }

    lane.titleEl.textContent = "Loading…";
    lane.titleEl.href        = "";

    if (cfg.source === "spankbang") {
      const playlists = await fetchSbPlaylists(SB_PLAYLISTS_URL);
      console.log("[grid] sb playlists found:", playlists.map(p => p.title));
      const target = cfg.playlistSearch
        ? (playlists.find(p => p.href.toLowerCase().includes(cfg.playlistSearch)) || playlists[0])
        : playlists[0];
      if (target) {
        lane.playlistUrl          = target.href;
        lane.headerEl.textContent = `SpankBang · ${target.title}`;
        const result              = await fetchSbForLane(target.href, 0);
        lane.videos               = result.videos;
        lane.nextPageUrl          = result.nextPageUrl;
      }
    } else {
      lane.videos = await fetchVideosForLane(cfg.source, cfg.sort, 1);
    }

    if (lane.videos.length > 0) {
      const randomId = lane.videos[Math.floor(Math.random() * lane.videos.length)].id;
      await gridLoadVideo(i, randomId);
    } else {
      lane.titleEl.textContent = "Nothing found";
    }
  }));
}
