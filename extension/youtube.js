(() => {
  "use strict";
  if (location.hostname !== "youtube.com" && !location.hostname.endsWith(".youtube.com")) return;
  const HIDDEN = "data-rb-hidden";
  const SHELVES = "ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts], ytm-reel-shelf-renderer";
  const SHORTS_NAV = 'ytd-guide-entry-renderer a[title="Shorts"], ytd-mini-guide-entry-renderer a[title="Shorts"]';
  const CARDS = "ytd-rich-item-renderer, ytd-video-renderer, ytd-grid-video-renderer, ytd-compact-video-renderer, ytd-reel-item-renderer, ytm-video-with-context-renderer, ytm-shorts-lockup-view-model, ytm-reel-item-renderer, ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer, yt-shorts-lockup-view-model, yt-shorts-lockup-view-model-v2";
  let enabled = true;
  let ready = !globalThis.browser?.storage;
  let scheduled = false;
  let screen;

  function isShort(value) {
    try {
      const url = new URL(value, location.href);
      return (url.hostname === "youtube.com" || url.hostname.endsWith(".youtube.com")) &&
        /^\/shorts(?:\/|$)/i.test(url.pathname);
    } catch { return false; }
  }

  function pauseShorts() {
    // Never pause the normal watch, embedded, or mini player based on duration or aspect ratio.
    if (!ready || !enabled || !isShort(location.href)) return;
    for (const video of document.querySelectorAll("video")) video.pause();
  }

  function showScreen() {
    if (!document.body) return;
    if (!screen) {
      screen = document.createElement("div");
      screen.id = "rb-screen";
      const root = screen.attachShadow({ mode: "closed" });
      root.innerHTML = `<style>
        main { box-sizing:border-box; height:100%; display:flex; flex-direction:column;
          align-items:center; justify-content:center; padding:32px; text-align:center;
          background:#111827; color:#f9fafb; font:17px/1.6 system-ui,sans-serif; }
        h1 { font-size:32px; margin:0 0 12px; } p { margin:0 0 28px; max-width:420px; color:#d1d5db; }
        a { background:#f9fafb; color:#111827; padding:12px 24px; border-radius:12px;
          text-decoration:none; font-weight:600; } a:focus-visible { outline:3px solid #60a5fa; outline-offset:5px; }
      </style><main aria-labelledby="title"><h1 id="title">YouTube Shorts are blocked</h1>
        <p>Regular YouTube videos are still available.</p>
        <a href="https://www.youtube.com/">Back to YouTube</a></main>`;
      if (globalThis.AppI18n) {
        screen.dir = AppI18n.direction;
        root.querySelector("h1").textContent = AppI18n.t("blockedShortsTitle");
        root.querySelector("p").textContent = AppI18n.t("blockedShortsBody");
        root.querySelector("a").textContent = AppI18n.t("backToYouTube");
      }
    }
    if (!screen.isConnected) document.body.append(screen);
  }

  function scan() {
    scheduled = false;
    if (!ready) return;
    if (enabled && isShort(location.href)) {
      if (document.documentElement.getAttribute("data-rb-blocked") !== "true") {
        document.documentElement.setAttribute("data-rb-blocked", "true");
      }
      showScreen();
      pauseShorts();
    } else {
      document.documentElement.removeAttribute("data-rb-blocked");
      screen?.remove();
    }
    const targets = new Set();
    if (enabled) {
      for (const shelf of document.querySelectorAll(SHELVES)) {
        targets.add(shelf);
      }
      for (const link of document.querySelectorAll("a[href]")) {
        if (isShort(link.href)) targets.add(link.closest("ytm-shorts-lockup-view-model-v2") || link.closest(CARDS) || link);
      }
      for (const link of document.querySelectorAll(SHORTS_NAV)) {
        targets.add(link.closest("ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer"));
      }
    }
    for (const element of document.querySelectorAll(`[${HIDDEN}]`)) {
      if (!targets.has(element)) element.removeAttribute(HIDDEN);
    }
    for (const element of targets) {
      if (element.getAttribute(HIDDEN) !== "true") element.setAttribute(HIDDEN, "true");
    }
  }

  function schedule() {
    if (!scheduled) { scheduled = true; setTimeout(scan, 50); }
  }
  function intercept(event) {
    const link = event.target instanceof Element ? event.target.closest("a") : null;
    if (!ready || !enabled || !link || (!isShort(link.href) && !link.matches(SHORTS_NAV))) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  document.addEventListener("click", intercept, true);
  document.addEventListener("auxclick", intercept, true);
  document.addEventListener("play", pauseShorts, true);
  document.addEventListener("playing", pauseShorts, true);
  document.addEventListener("yt-navigate-finish", scan);
  new MutationObserver(schedule).observe(document, {
    childList: true, subtree: true, attributes: true, attributeFilter: ["href", "is-shorts", "title"]
  });
  addEventListener("popstate", scan);
  addEventListener("pageshow", scan);
  let previousURL = location.href;
  setInterval(() => {
    if (location.href !== previousURL) { previousURL = location.href; scan(); }
  }, 250);
  if (globalThis.browser?.storage) {
    let revision = 0;
    const update = value => { enabled = typeof value === "boolean" ? value : true; ready = true; scan(); };
    browser.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && "blockShorts" in changes) {
        revision++;
        update(changes.blockShorts.newValue);
      }
    });
    const initialRevision = revision;
    browser.storage.local.get({ blockShorts: true }).then(values => {
      if (revision === initialRevision) update(values.blockShorts);
    }).catch(() => { if (!ready) update(true); });
  } else scan();
})();
