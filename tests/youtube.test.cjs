const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const script = fs.readFileSync('extension/youtube.js', 'utf8');
const wait = () => new Promise(resolve => setTimeout(resolve, 90));
function storage(initial = {}) {
  const values = { ...initial }, listeners = [];
  return {
    local: {
      async get(defaults) { return { ...defaults, ...values }; },
      async set(update) {
        const changes = {};
        for (const [key, value] of Object.entries(update)) {
          changes[key] = { newValue: value }; values[key] = value;
        }
        for (const fn of listeners) fn(changes, 'local');
      }
    },
    onChanged: { addListener(fn) { listeners.push(fn); } }
  };
}
function page(t, html = '', path = '/', store, host = 'www.youtube.com') {
  const dom = new JSDOM(html, { url: `https://${host}${path}`, runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  if (store) dom.window.browser = { storage: store };
  dom.window.HTMLMediaElement.prototype.pause = function () { this.wasPaused = true; };
  dom.window.eval(script);
  return dom.window;
}
const hidden = (w, selector) => w.document.querySelector(selector).dataset.rbHidden === 'true';

test('YouTube hides Shorts cards, shelves and navigation, preserving ordinary results and media', t => {
  const w = page(t, `<main><ytd-rich-item-renderer id="short"><a href="/shorts/123">Short</a></ytd-rich-item-renderer>
    <ytd-reel-shelf-renderer id="shelf">Shorts</ytd-reel-shelf-renderer>
    <ytd-guide-entry-renderer id="nav"><a href="/shorts/">Shorts</a></ytd-guide-entry-renderer>
    <ytd-video-renderer id="normal"><a href="/watch?v=123">Video</a><video></video><img></ytd-video-renderer>
    <ytd-rich-shelf-renderer id="mixed"><a href="/watch?v=456">Video</a></ytd-rich-shelf-renderer></main>`);
  for (const id of ['short', 'shelf', 'nav']) assert.equal(hidden(w, `#${id}`), true);
  for (const selector of ['main', '#normal', '#mixed', 'video', 'img']) assert.equal(hidden(w, selector), false);
  const video = w.document.querySelector('video'); video.dispatchEvent(new w.Event('play'));
  assert.equal(video.wasPaused, undefined);
});

test('YouTube blocks only exact Shorts paths on actual YouTube hosts, including modifier and middle clicks', t => {
  const w = page(t, `<a id="short" href="https://m.youtube.com/shorts/123?feature=share"><span>Short</span></a>
    <a id="normal" href="/watch?v=123">Video</a><a id="playlist" href="/playlist?list=1">Playlist</a>
    <a id="similar" href="/shortstory">Other</a><a id="external" href="https://youtube.com.evil.test/shorts/1">External</a>`);
  for (const type of ['click', 'auxclick']) {
    const e = new w.MouseEvent(type, { bubbles:true, cancelable:true, ctrlKey:true, metaKey:true });
    w.document.querySelector('#short span').dispatchEvent(e); assert.equal(e.defaultPrevented, true);
  }
  for (const id of ['normal', 'playlist', 'similar', 'external']) {
    assert.equal(hidden(w, `#${id}`), false);
    const e = new w.MouseEvent('click', { bubbles:true, cancelable:true });
    const a = w.document.getElementById(id);
    a.addEventListener('click', () => { assert.equal(e.defaultPrevented, false); e.preventDefault(); });
    a.dispatchEvent(e);
  }
});

test('direct desktop and mobile Shorts pages block playback and show the screen', t => {
  for (const host of ['www.youtube.com', 'm.youtube.com', 'youtube.com']) {
    const w = page(t, '<video></video>', '/shorts/123', undefined, host);
    assert.equal(w.document.documentElement.dataset.rbBlocked, 'true');
    assert.ok(w.document.getElementById('rb-screen'));
    const v = w.document.querySelector('video');
    for (const name of ['play', 'playing']) { v.wasPaused = false; v.dispatchEvent(new w.Event(name)); assert.equal(v.wasPaused, true); }
  }
});

test('normal watch, embedded, live and home players are never paused or hidden', t => {
  for (const path of ['/watch?v=123', '/watch?v=123&feature=shorts', '/embed/123', '/live/123', '/']) {
    const w = page(t, '<main><video autoplay></video><img></main>', path);
    const v = w.document.querySelector('video'); v.dispatchEvent(new w.Event('play')); v.dispatchEvent(new w.Event('playing'));
    assert.equal(v.wasPaused, undefined); assert.equal(hidden(w, 'video'), false); assert.equal(hidden(w, 'img'), false);
    assert.equal(w.document.getElementById('rb-screen'), null);
  }
});

test('YouTube handles dynamic Shorts and recycles cards back to normal results', async t => {
  const w = page(t, '<ytd-rich-item-renderer id="card"><a href="/watch?v=1">Video</a></ytd-rich-item-renderer>');
  const a = w.document.querySelector('a'); a.href = '/shorts/1'; await wait(); assert.equal(hidden(w, '#card'), true);
  a.href = '/watch?v=1'; await wait(); assert.equal(hidden(w, '#card'), false);
  const shelf = w.document.createElement('ytd-rich-shelf-renderer'); shelf.setAttribute('is-shorts','');
  w.document.body.append(shelf); await wait(); assert.equal(shelf.dataset.rbHidden, 'true');
  shelf.removeAttribute('is-shorts'); await wait(); assert.equal(shelf.hasAttribute('data-rb-hidden'), false);
});

test('YouTube SPA navigation restores normal playback immediately, including Back and Forward', async t => {
  const w = page(t, '<video></video>', '/watch?v=1');
  w.history.pushState({}, '', '/shorts/1'); w.document.dispatchEvent(new w.Event('yt-navigate-finish'));
  assert.ok(w.document.getElementById('rb-screen'));
  w.history.pushState({}, '', '/watch?v=2'); w.dispatchEvent(new w.Event('popstate'));
  assert.equal(w.document.getElementById('rb-screen'), null);
  const v = w.document.querySelector('video'); v.wasPaused = false; v.dispatchEvent(new w.Event('play')); assert.equal(v.wasPaused, false);
  w.history.pushState({}, '', '/shorts/2'); await new Promise(resolve => setTimeout(resolve, 320));
  assert.ok(w.document.getElementById('rb-screen'));
});

test('Shorts setting restores cards, navigation and playback live across tabs, independently of Facebook settings', async t => {
  const store = storage({ blockVideos:false, blockImages:false });
  const home = page(t, '<a href="/shorts/1">Short</a>', '/', store);
  const short = page(t, '<video></video>', '/shorts/1', store);
  await wait(); assert.equal(hidden(home, 'a'), true); assert.ok(short.document.getElementById('rb-screen'));
  await store.local.set({ blockShorts:false }); await wait();
  assert.equal(hidden(home, 'a'), false); assert.equal(short.document.getElementById('rb-screen'), null);
  const v = short.document.querySelector('video'); v.wasPaused = false; v.dispatchEvent(new short.Event('play')); assert.equal(v.wasPaused, false);
  await store.local.set({ blockVideos:true, blockImages:true }); await wait(); assert.equal(hidden(home, 'a'), false);
  await store.local.set({ blockShorts:true }); await wait(); assert.equal(hidden(home, 'a'), true);
});

test('saved disabled Shorts setting allows direct Shorts without first pausing playback', async t => {
  const w = page(t, '<video></video>', '/shorts/1', storage({ blockShorts:false }));
  await wait(); assert.equal(w.document.getElementById('rb-screen'), null);
  assert.equal(w.document.querySelector('video').wasPaused, undefined);
});

test('Shorts setting persists through popup reopening and applies to YouTube', async t => {
  const store = storage(); const home = page(t, '<a href="/shorts/1">Short</a>', '/', store);
  const html = fs.readFileSync('extension/popup.html', 'utf8'); const popup = fs.readFileSync('extension/popup.js', 'utf8');
  const makePanel = () => { const w = page(t, html, '/', store); w.eval(popup); return w; };
  const panel = makePanel(); await wait(); const input = panel.document.getElementById('blockShorts');
  assert.equal(input.checked, true); input.checked = false; input.dispatchEvent(new panel.Event('change')); await wait();
  assert.equal(hidden(home, 'a'), false); const reopened = makePanel(); await wait();
  assert.equal(reopened.document.getElementById('blockShorts').checked, false);
  assert.equal(reopened.document.getElementById('blockVideos').checked, true);
});

test('YouTube guard ignores lookalike hosts', t => {
  const w = page(t, '<video></video><a href="/shorts/1">Short</a>', '/shorts/1', undefined, 'youtube.com.evil.test');
  assert.equal(w.document.getElementById('rb-screen'), null); assert.equal(hidden(w, 'a'), false);
  assert.equal(w.document.querySelector('video').wasPaused, undefined);
});

test('YouTube starts at document_start before the body exists', async t => {
  const w = page(t); w.document.body.remove(); w.history.pushState({}, '', '/shorts/1');
  w.document.dispatchEvent(new w.Event('yt-navigate-finish'));
  const body = w.document.createElement('body'); w.document.documentElement.append(body); await wait();
  assert.ok(body.querySelector('#rb-screen'));
});


test('current YouTube markup hides href-less Shorts navigation and outer v2 cards', t => {
  const w = page(t, `<ytd-guide-entry-renderer id="nav"><a title="Shorts"><span>Shorts</span></a></ytd-guide-entry-renderer>
    <ytm-shorts-lockup-view-model-v2 id="card"><ytm-shorts-lockup-view-model><a href="/shorts/123">Short</a></ytm-shorts-lockup-view-model></ytm-shorts-lockup-view-model-v2>
    <grid-shelf-view-model id="mixed"><a href="/watch?v=123">Normal video</a><a href="/shorts/2">Short</a></grid-shelf-view-model>`);
  assert.equal(hidden(w, '#nav'), true); assert.equal(hidden(w, '#card'), true); assert.equal(hidden(w, '#mixed'), false);
  const e = new w.MouseEvent('click', { bubbles:true, cancelable:true });
  w.document.querySelector('#nav span').dispatchEvent(e); assert.equal(e.defaultPrevented, true);
});
