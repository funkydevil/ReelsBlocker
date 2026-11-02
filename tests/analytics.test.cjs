const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');
function client({ response = { ok: true, enabled: true }, failed = false, setup = false } = {}) {
  const messages = [];
  const context = vm.createContext({ browser: { runtime: { sendNativeMessage: async (host, payload) => {
    messages.push({ host, payload }); if (failed) throw Error('native unavailable'); return response;
  } } }, webkit: { messageHandlers: { analytics: { postMessage: payload => messages.push({ payload }) } } } });
  vm.runInContext(fs.readFileSync('extension/analytics.js', 'utf8'), context);
  return { api: context.AppAnalytics, messages };
}
test('popup reads the shared native preference, including default-on and saved opt-out', async () => {
  const on = client(); assert.equal(await on.api.init('popup'), true);
  assert.equal(on.messages[0].host, 'local.reelsblocker');
  assert.equal(on.messages[0].payload.action, 'analytics_get');
  const off = client({ response: { ok: true, enabled: false } }); assert.equal(await off.api.init('popup'), false);
});
test('changing the preference uses the native store and reports persistence failures', async () => {
  const c = client({ response: { ok: true, enabled: false } }); await c.api.init('popup');
  assert.equal(await c.api.setEnabled(false), false);
  assert.equal(c.messages.at(-1).payload.action, 'analytics_set'); assert.equal(c.messages.at(-1).payload.enabled, false);
  const bad = client({ response: { ok: false } }); await bad.api.init('popup'); await assert.rejects(bad.api.setEnabled(false));
});
test('popup exposes no event-capture API and native failures remain contained', async () => {
  const c = client({ failed: true }); assert.equal(await c.api.init('popup'), false);
  assert.equal(c.api.capture, undefined);
  await assert.rejects(c.api.setEnabled(false));
});
test('background records a launch only on startup/install, not script loads or repeated callbacks', async () => {
  const callbacks = {}, messages = [];
  const context = vm.createContext({ browser: { runtime: {
    onStartup: { addListener: callback => { callbacks.startup = callback; } },
    onInstalled: { addListener: callback => { callbacks.installed = callback; } },
    sendNativeMessage: async (host, payload) => { messages.push({ host, payload }); }
  } } });
  vm.runInContext(fs.readFileSync('extension/background.js', 'utf8'), context);
  assert.equal(messages.length, 0);
  callbacks.startup(); callbacks.installed(); callbacks.startup();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(messages.length, 1);
  assert.equal(messages[0].host, 'local.reelsblocker');
  assert.equal(messages[0].payload.action, 'analytics_extension_started');
  assert.deepEqual(Object.keys(messages[0].payload), ['action']);
});
test('analytics preference is revealed only through Settings in the extension popup', async t => {
  const dom = new JSDOM(fs.readFileSync('extension/popup.html', 'utf8'), { runScripts: 'outside-only' }); t.after(() => dom.window.close());
  dom.window.browser = { storage: { local: { get: async d => d, set: async () => {} } } };
  const messages = [];
  dom.window.browser.runtime = { sendNativeMessage: async (host, payload) => { messages.push(payload); return { ok: true, enabled: payload.enabled ?? true }; } };
  dom.window.eval(fs.readFileSync('extension/analytics.js', 'utf8'));
  dom.window.eval(fs.readFileSync('extension/popup.js', 'utf8'));
  const panel = dom.window.document.getElementById('analytics-settings');
  assert.equal(panel.hidden, true); dom.window.document.querySelector('.open-settings').click(); assert.equal(panel.hidden, false);
  await new Promise(resolve => setImmediate(resolve)); assert.equal(dom.window.document.querySelector('.analytics-consent').checked, true);
  dom.window.document.getElementById('blockVideos').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(messages.map(x => x.action), ['analytics_get']);
  dom.window.document.querySelector('.analytics-consent').click();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(messages.map(x => x.action), ['analytics_get', 'analytics_set']);
  assert.equal(messages.at(-1).enabled, false);
  assert.equal(fs.readFileSync('Safari/ReelsBlocker/ReelsBlocker/Resources/Base.lproj/Main.html', 'utf8').includes('analytics-consent'), false);
});
test('website content scripts do not load analytics or get PostHog host permissions', () => {
  const manifest = JSON.parse(fs.readFileSync('extension/manifest.json', 'utf8'));
  for (const entry of manifest.content_scripts) assert.equal(entry.js.some(x => x.startsWith('analytics')), false);
  assert.equal(manifest.host_permissions, undefined);
});
