const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const content = fs.readFileSync('extension/content.js', 'utf8');
const popup = fs.readFileSync('extension/popup.js', 'utf8');
const popupHTML = fs.readFileSync('extension/popup.html', 'utf8');
const tick = () => new Promise(resolve => setTimeout(resolve, 80));
function storage(initial = {}) {
  const values = { ...initial }, listeners = [];
  return {
    local: {
      async get(defaults) { return { ...defaults, ...values }; },
      async set(update) {
        const changes = {};
        for (const [key, value] of Object.entries(update)) {
          changes[key] = { oldValue: values[key], newValue: value }; values[key] = value;
        }
        for (const listener of listeners) listener(changes, 'local');
      }
    },
    onChanged: { addListener(fn) { listeners.push(fn); } }
  };
}
function make(t, html, store, script, path = '/') {
  const dom = new JSDOM(html, { url: `https://www.facebook.com${path}`, runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  dom.window.browser = { storage: store };
  dom.window.HTMLMediaElement.prototype.pause = function () { this.wasPaused = true; };
  dom.window.eval(script);
  return dom.window;
}
const html = `<main><article id="v"><video></video></article><article id="photo">Text<img id="img" src="photo.jpg"><svg><image href="photo.jpg"></image></svg><div id="background" style="background-image:url(photo.jpg)"></div></article></main>`;
const hidden = (w, id) => w.document.getElementById(id).dataset.rbHidden === 'true';

test('all four setting combinations work independently and restore hidden content live', async t => {
  const store = storage();
  const w = make(t, html, store, content);
  for (const [blockVideos, blockImages] of [[true,true],[false,true],[true,false],[false,false]]) {
    await store.local.set({ blockVideos, blockImages }); await tick();
    assert.equal(hidden(w, 'v'), blockVideos);
    assert.equal(hidden(w, 'img'), blockImages);
    assert.equal(hidden(w, 'background'), blockImages);
    assert.equal(w.document.querySelector('svg image').dataset.rbHidden === 'true', blockImages);
    assert.equal(hidden(w, 'photo'), false);
  }
});

test('saved disabled settings are respected on initial load and playing is allowed', async t => {
  const w = make(t, html, storage({ blockVideos:false, blockImages:false }), content);
  await tick();
  assert.equal(hidden(w, 'v'), false); assert.equal(hidden(w, 'img'), false);
  const video = w.document.querySelector('video');
  video.dispatchEvent(new w.Event('play'));
  assert.equal(video.wasPaused, undefined);
});

test('turning video blocking off removes the Reels screen and enables Reel links', async t => {
  const store = storage();
  const w = make(t, '<a href="/reel/12">Reel</a>', store, content, '/reel/12');
  await tick(); assert.ok(w.document.getElementById('rb-screen'));
  await store.local.set({ blockVideos:false }); await tick();
  assert.equal(w.document.getElementById('rb-screen'), null);
  const e = new w.MouseEvent('click', { bubbles:true, cancelable:true });
  w.document.querySelector('a').addEventListener('click', () => { assert.equal(e.defaultPrevented, false); e.preventDefault(); });
  w.document.querySelector('a').dispatchEvent(e);
});

test('dynamic images hide, chat images remain visible, and settings reach multiple tabs', async t => {
  const store = storage();
  const first = make(t, '<main><article id="post">Text</article><div role="dialog"><img id="chat"></div></main>', store, content);
  const second = make(t, html, store, content);
  const image = first.document.createElement('img'); first.document.getElementById('post').append(image);
  await tick(); assert.equal(image.dataset.rbHidden, 'true'); assert.equal(hidden(first, 'chat'), false);
  await store.local.set({ blockImages:false }); await tick();
  assert.equal(image.hasAttribute('data-rb-hidden'), false); assert.equal(hidden(second, 'img'), false);
});

test('popup saves checkboxes, updates feed and retains values after reopening', async t => {
  const store = storage();
  const feed = make(t, html, store, content);
  const panel = make(t, popupHTML, store, popup);
  await tick();
  const input = panel.document.getElementById('blockVideos');
  assert.equal(input.checked, true);
  input.checked = false; input.dispatchEvent(new panel.Event('change'));
  await tick();
  assert.equal(hidden(feed, 'v'), false); assert.equal(hidden(feed, 'img'), true);
  const reopened = make(t, popupHTML, store, popup); await tick();
  assert.equal(reopened.document.getElementById('blockVideos').checked, false);
  assert.equal(reopened.document.getElementById('blockImages').checked, true);
});

test('popup rolls back a checkbox and reports a storage write failure', async t => {
  const store = storage();
  store.local.set = async () => { throw new Error('Storage unavailable'); };
  const panel = make(t, popupHTML, store, popup); await tick();
  const input = panel.document.getElementById('blockImages');
  input.checked = false; input.dispatchEvent(new panel.Event('change')); await tick();
  assert.equal(input.checked, true);
  assert.match(panel.document.getElementById('status').textContent, /Could not save/);
  assert.equal(panel.document.querySelector('fieldset').disabled, false);
});
