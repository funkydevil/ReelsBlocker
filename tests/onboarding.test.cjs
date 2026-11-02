const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const root = 'Safari/ReelsBlocker/ReelsBlocker/Resources/';

function onboarding(t) {
  const dom = new JSDOM(fs.readFileSync(root + 'Base.lproj/Main.html', 'utf8'), { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  const messages = [];
  dom.window.webkit = { messageHandlers: { controller: { postMessage: message => messages.push(message) } } };
  dom.window.eval(fs.readFileSync(root + 'Script.js', 'utf8'));
  return { window: dom.window, button: dom.window.document.querySelector('button'), messages };
}

test('opening settings prevents duplicate requests and allows retry after failure', t => {
  const { window, button, messages } = onboarding(t);
  button.click();
  button.click();
  assert.deepEqual(messages, ['open-preferences']);
  assert.equal(button.disabled, true);
  window.finishOpeningPreferences('Try Safari → Settings → Extensions.', true);
  assert.equal(button.disabled, false);
  assert.equal(window.document.querySelector('.feedback').classList.contains('error'), true);
  assert.equal(window.document.querySelector('details').open, true);
  button.click();
  assert.equal(messages.length, 2);
});

test('native feedback is displayed as text and success clears the error state', t => {
  const { window, button } = onboarding(t);
  const message = '<img src=x onerror="throw 1">';
  window.finishOpeningPreferences(message, true);
  const feedback = window.document.querySelector('.feedback');
  assert.equal(feedback.textContent, message);
  assert.equal(feedback.children.length, 0);
  window.finishOpeningPreferences('Settings opened.', false);
  assert.equal(feedback.classList.contains('error'), false);
  assert.equal(button.disabled, false);
  assert.equal(window.document.querySelector('details').open, false);
});

test('returning from Safari updates enabled state and clears stale state on lookup failure', t => {
  const { window } = onboarding(t);
  window.show(false);
  assert.equal(window.document.body.className, 'state-off');
  window.show(true);
  assert.equal(window.document.body.className, 'state-on');
  window.show(null);
  assert.equal(window.document.body.className, '');
});
