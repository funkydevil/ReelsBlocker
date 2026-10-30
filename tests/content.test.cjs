const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const script = fs.readFileSync('extension/content.js', 'utf8');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function page(t, html = '', path = '/') {
  const dom = new JSDOM(html, { url: `https://www.facebook.com${path}`, runScripts: 'outside-only' });
  dom.window.HTMLMediaElement.prototype.pause = function () { this.wasPaused = true; };
  t.after(() => dom.window.close());
  dom.window.eval(script);
  return dom.window;
}

test('hides Reel posts and navigation, preserves text links and external lookalikes', t => {
  const w = page(t, `<div role="feed"><article id="reel"><a href="/reel/123">Clip</a><video></video></article>
    <article id="normal"><a href="/watch/?v=1">Video</a></article>
    <article id="external"><a href="https://facebook.com.evil.test/reel/1">External</a></article>
    <a id="nav" href="/reels/">Reels</a><a id="similar" href="/reelistic">Other</a></div>`);
  const hidden = id => w.document.getElementById(id).hasAttribute('data-rb-hidden');
  assert.equal(hidden('reel'), true);
  assert.equal(hidden('nav'), true);
  for (const id of ['normal', 'external', 'similar']) assert.equal(hidden(id), false);
  assert.equal(w.document.querySelector('[role="feed"]').hasAttribute('data-rb-hidden'), false);
  assert.equal(w.document.querySelector('video').wasPaused, true);
});

test('hides all video posts while keeping text and photo posts and the feed visible', t => {
  const w = page(t, `<main><div role="feed">
    <article id="video"><a href="/watch/?v=1">Video</a><video autoplay></video></article>
    <div role="article" id="live"><video></video></div>
    <article id="text">Text post</article><article id="photo"><img src="photo.jpg"></article>
  </div></main>`);
  for (const id of ['video', 'live']) assert.equal(w.document.getElementById(id).dataset.rbHidden, 'true');
  for (const id of ['text', 'photo']) assert.equal(w.document.getElementById(id).hasAttribute('data-rb-hidden'), false);
  for (const video of w.document.querySelectorAll('video')) {
    assert.equal(video.wasPaused, true);
    assert.equal(video.dataset.rbHidden, 'true');
    video.wasPaused = false;
    video.dispatchEvent(new w.Event('play'));
    assert.equal(video.wasPaused, true);
  }
  assert.equal(w.document.querySelector('main').hasAttribute('data-rb-hidden'), false);
  assert.equal(w.document.querySelector('[role="feed"]').hasAttribute('data-rb-hidden'), false);
});

test('blocks dynamically loaded videos and restores a post recycled as text', async t => {
  const w = page(t, '<main><article id="post">Post</article></main>');
  const post = w.document.getElementById('post');
  const video = w.document.createElement('video');
  post.append(video);
  await wait(100);
  assert.equal(post.dataset.rbHidden, 'true');
  assert.equal(video.wasPaused, true);
  video.remove();
  await wait(100);
  assert.equal(post.hasAttribute('data-rb-hidden'), false);
});

test('blocks feed videos without article wrappers without hiding the whole page', t => {
  const w = page(t, '<main><div><video></video></div><p>Keep</p></main>');
  assert.equal(w.document.querySelector('video').dataset.rbHidden, 'true');
  assert.equal(w.document.querySelector('main').hasAttribute('data-rb-hidden'), false);
});

test('keeps private-message and floating chat videos outside the feed policy', t => {
  const chat = page(t, '<main><div role="dialog"><video></video></div></main>');
  const messages = page(t, '<main><video></video></main>', '/messages/t/123');
  for (const w of [chat, messages]) {
    const video = w.document.querySelector('video');
    video.dispatchEvent(new w.Event('play'));
    assert.equal(video.wasPaused, undefined);
    assert.equal(video.hasAttribute('data-rb-hidden'), false);
  }
});

test('blocks direct Reel pages and stops playback', t => {
  const w = page(t, '<video></video>', '/reel/123?foo=bar');
  assert.equal(w.document.documentElement.dataset.rbBlocked, 'true');
  assert.ok(w.document.getElementById('rb-screen'));
  const video = w.document.querySelector('video');
  video.wasPaused = false;
  video.dispatchEvent(new w.Event('play'));
  assert.equal(video.wasPaused, true);
});

test('handles dynamic insertions, changed hrefs and recycled feed cards', async t => {
  const w = page(t, '<article id="card"><a href="/watch/?v=1">Video</a></article>');
  const card = w.document.getElementById('card');
  card.querySelector('a').href = '/reels/123';
  await wait(100);
  assert.equal(card.dataset.rbHidden, 'true');
  card.querySelector('a').href = '/watch/?v=2';
  await wait(100);
  assert.equal(card.hasAttribute('data-rb-hidden'), false);
  const nav = w.document.createElement('a');
  nav.href = 'https://m.facebook.com/reel/42';
  w.document.body.append(nav);
  await wait(100);
  assert.equal(nav.dataset.rbHidden, 'true');
});

test('blocks SPA pushState navigation and restores the feed on return', async t => {
  const w = page(t);
  w.history.pushState({}, '', '/reels/12');
  await wait(320);
  assert.equal(w.document.documentElement.dataset.rbBlocked, 'true');
  w.history.pushState({}, '', '/');
  await wait(320);
  assert.equal(w.document.documentElement.hasAttribute('data-rb-blocked'), false);
  assert.equal(w.document.getElementById('rb-screen'), null);
});

test('cancels Reel clicks, including middle click, without cancelling normal links', t => {
  const w = page(t, '<a id="reel" href="/reel/42"><span>Clip</span></a><a id="normal" href="/watch/">Watch</a>');
  for (const type of ['click', 'auxclick']) {
    const event = new w.MouseEvent(type, { bubbles: true, cancelable: true });
    w.document.querySelector('#reel span').dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
  }
  const event = new w.MouseEvent('click', { bubbles: true, cancelable: true });
  w.document.getElementById('normal').dispatchEvent(event);
  assert.equal(event.defaultPrevented, false);
  event.preventDefault();
});

test('hides a labeled Reels shelf without hiding surrounding content', t => {
  const w = page(t, '<main><section aria-label="Reels"><a href="/reel/1">Clip</a></section><p id="keep">Post</p></main>');
  assert.equal(w.document.querySelector('section').dataset.rbHidden, 'true');
  assert.equal(w.document.querySelector('main').hasAttribute('data-rb-hidden'), false);
});

test('starts before body exists, then blocks after the body arrives', async t => {
  const w = page(t, '', '/reels/');
  w.document.body.remove();
  await wait(100);
  const body = w.document.createElement('body');
  w.document.documentElement.append(body);
  await wait(100);
  assert.ok(body.querySelector('#rb-screen'));
});
