(() => {
  "use strict";
  const REEL_PATH = /^\/reels?(?:\/|$)/i;
  const HIDDEN = "data-rb-hidden";
  let scheduled = false;
  let screen;
  const settings = { blockVideos: true, blockImages: true };
  let ready = !globalThis.browser?.storage;

  function isReel(value) {
    try {
      const url = new URL(value, location.href);
      return (url.hostname === "facebook.com" || url.hostname.endsWith(".facebook.com")) &&
        REEL_PATH.test(url.pathname);
    } catch { return false; }
  }

  function hide(element) {
    if (!element || element.getAttribute(HIDDEN) === "true") return;
    element.setAttribute(HIDDEN, "true");
    if (element.matches("video")) element.pause();
    for (const video of element.querySelectorAll("video")) video.pause();
  }

  function isFeedContent(video) {
    // Keep private-message and floating chat videos outside the feed policy.
    if (/^\/messages(?:\/|$)/i.test(location.pathname) ||
        video.closest('[role="dialog"], [role="complementary"], aside')) return false;
    return Boolean(video.closest('[role="feed"], [role="article"], article, [role="main"], main')) ||
      location.pathname === "/";
  }

  function blockVideo(video) {
    video.pause();
    hide(video);
    hide(video.closest('[role="article"], article'));
  }

  function pauseReels() {
    if (isReel(location.href)) {
      for (const video of document.querySelectorAll("video")) video.pause();
    }
  }

  function showScreen() {
    if (!document.body) return;
    if (!screen) {
      screen = document.createElement("div");
      screen.id = "rb-screen";
      // Shadow DOM keeps Facebook's styles away from the blocking screen.
      const root = screen.attachShadow({ mode: "closed" });
      root.innerHTML = `<style>
        :host { color-scheme: light dark; }
        main { box-sizing:border-box; height:100%; display:flex; flex-direction:column;
          align-items:center; justify-content:center; padding:32px; text-align:center;
          background:#111827; color:#f9fafb; font:17px/1.6 system-ui,sans-serif; }
        h1 { font-size:32px; margin:0 0 12px; } p { margin:0 0 28px; max-width:420px; color:#d1d5db; }
        a { background:#f9fafb; color:#111827; padding:12px 24px; border-radius:12px;
          text-decoration:none; font-weight:600; } a:focus-visible { outline:3px solid #60a5fa; outline-offset:5px; }
        small { margin-top:28px; color:#9ca3af; }
      </style><main role="main" aria-labelledby="title"><h1 id="title">Reels are blocked</h1>
      <p>Return to your Facebook feed and continue without short videos.</p>
      <a href="https://www.facebook.com/">Back to feed</a><small>Short Video Blocker</small></main>`;
      if (globalThis.AppI18n) {
        screen.dir = AppI18n.direction;
        root.querySelector("h1").textContent = AppI18n.t("blockedFacebookTitle");
        root.querySelector("p").textContent = AppI18n.t("blockedFacebookBody");
        root.querySelector("a").textContent = AppI18n.t("backToFeed");
        root.querySelector("small").textContent = AppI18n.t("appName");
      }
    }
    if (!screen.isConnected) document.body.append(screen);
  }

  function scan() {
    scheduled = false;
    if (!ready) return;
    const blocked = settings.blockVideos && isReel(location.href);
    if (blocked) {
      if (document.documentElement.getAttribute("data-rb-blocked") !== "true") {
        document.documentElement.setAttribute("data-rb-blocked", "true");
      }
      showScreen();
      pauseReels();
    } else {
      document.documentElement.removeAttribute("data-rb-blocked");
      screen?.remove();
    }

    // Compute the desired state first so settings and recycled React nodes restore cleanly.
    const targets = new Set();
    if (settings.blockVideos) for (const link of document.querySelectorAll("a[href]")) {
      if (!isReel(link.href)) continue;
      // Only known content boundaries; never hide arbitrary ancestor divs or the feed itself.
      const card = link.closest('[role="article"], article');
      const shelf = link.closest('section, [role="region"]');
      const label = shelf?.getAttribute("aria-label")?.trim();
      targets.add(card || (/^(reels|\u0440\u0438\u043b\u0441|\u0440\u0438\u043b\u0441\u044b)$/i.test(label || "") ? shelf : link));
    }
    if (settings.blockVideos) for (const video of document.querySelectorAll("video")) {
      if (!isFeedContent(video)) continue;
      video.pause();
      targets.add(video);
      const card = video.closest('[role="article"], article');
      if (card) targets.add(card);
    }
    if (settings.blockImages) for (const picture of document.querySelectorAll('img, svg image, [style*="background-image"]')) {
      if (!isFeedContent(picture)) continue;
      if (picture.matches('[style*="background-image"]') && !picture.matches('img, svg image') &&
          !/url\(/i.test(picture.style.backgroundImage)) continue;
      // Hide the image itself: the post's text remains readable.
      targets.add(picture);
    }
    for (const element of document.querySelectorAll(`[${HIDDEN}]`)) {
      if (!targets.has(element)) element.removeAttribute(HIDDEN);
    }
    for (const element of targets) hide(element);
  }

  function schedule() {
    if (!scheduled) {
      scheduled = true;
      setTimeout(scan, 50);
    }
  }

  // Prevent normal and modifier-click navigation; direct/new-tab URLs are covered by the screen.
  function intercept(event) {
    const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
    if (!ready || !settings.blockVideos || !link || !isReel(link.href)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  document.addEventListener("click", intercept, true);
  document.addEventListener("auxclick", intercept, true);
  document.addEventListener("play", event => {
    if (!ready || !settings.blockVideos) return;
    if (event.target instanceof HTMLVideoElement && isFeedContent(event.target)) {
      blockVideo(event.target);
    } else if (isReel(location.href) || event.target.closest?.(`[${HIDDEN}="true"]`)) {
      event.target.pause?.();
    }
  }, true);
  new MutationObserver(schedule).observe(document, {
    childList: true, subtree: true, attributes: true, attributeFilter: ["href", "aria-label", "style", "role"]
  });
  addEventListener("popstate", schedule);
  addEventListener("pageshow", schedule);
  // Facebook uses pushState without a page load. Polling also covers isolated JS worlds.
  let previousURL = location.href;
  setInterval(() => {
    if (location.href !== previousURL) {
      previousURL = location.href;
      scan();
    }
  }, 250);
  if (globalThis.browser?.storage) {
    let revision = 0;
    const update = values => {
      for (const key of Object.keys(settings)) settings[key] = typeof values[key] === "boolean" ? values[key] : true;
      ready = true;
      scan();
    };
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      const values = { ...settings };
      let changed = false;
      for (const key of Object.keys(settings)) if (key in changes) {
        values[key] = changes[key].newValue;
        changed = true;
      }
      if (changed) { revision++; update(values); }
    });
    const initialRevision = revision;
    browser.storage.local.get(settings).then(values => {
      if (revision === initialRevision) update(values);
    }).catch(() => { if (!ready) update(settings); });
  } else scan();
})();
