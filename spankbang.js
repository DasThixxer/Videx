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

sbBackBtn.addEventListener("click", () => history.back());

// ─── SpankBang: fetch playlists from profile page ────────────────────────────
async function fetchSbPlaylists(url) {
  try {
    const res  = await fetch(url);
    const html = await res.text();
    const doc  = new DOMParser().parseFromString(html, "text/html");

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
  if (!restoringHistory) history.pushState(null, "", "?source=spankbang&playlist=" + encodeURIComponent(href));
}

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
      const a        = node.querySelector("a[href]");
      const titleA   = node.querySelector("a[title]");
      const img      = node.querySelector("img");
      const duration = node.querySelector("[data-testid='video-item-length']");
      const src      = a?.getAttribute("href") || "";
      return {
        id:       offset + i + 1,
        title:    titleA?.getAttribute("title") || img?.getAttribute("alt") || "Video",
        src,
        thumb:    img?.getAttribute("src") || img?.getAttribute("data-src") || "",
        duration: duration?.textContent?.trim() || "",
        views:    "",
        uploader: "",
      };
    }).filter((v) => v.src.includes("/video/"));
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
  const nodes = doc.querySelectorAll(".js-related-videos-right [data-testid='video-item']");
  return Array.from(nodes).map((node) => {
    const a        = node.querySelector("a[href]");
    const titleA   = node.querySelector("a[title]");
    const img      = node.querySelector("img");
    const duration = node.querySelector("[data-testid='video-item-length']");
    const src      = a?.getAttribute("href") || "";
    return {
      title:    titleA?.getAttribute("title") || img?.getAttribute("alt") || "Video",
      src,
      thumb:    img?.getAttribute("src") || img?.getAttribute("data-src") || "",
      duration: duration?.textContent?.trim() || "",
    };
  }).filter((v) => v.src.includes("/video/"));
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
  videoTitle.href              = pageUrl;
  videoViews.textContent       = "";
  videoDuration.textContent    = "";
  videoDescription.textContent = "";
  videoDate.textContent        = "";

  prevBtn.disabled = true;
  nextBtn.disabled = true;
  currentId = null;
  const plParam2 = sbCurrentUrl !== SB_PLAYLISTS_URL
    ? "&playlist=" + encodeURIComponent(sbCurrentUrl) : "";
  if (!restoringHistory) history.pushState(null, "", "?source=spankbang&v=" + encodeURIComponent(v.src) + plParam2);
  document.querySelectorAll(".playlist-item").forEach((el) => el.classList.remove("active"));
}

// ─── SpankBang: load more videos (infinite scroll) ───────────────────────────
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
