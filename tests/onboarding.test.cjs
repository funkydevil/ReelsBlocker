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
  return { window: dom.window, document: dom.window.document, messages };
}

test('opening settings shows checkbox instructions before leaving and prevents duplicate requests', t => {
  const { document, messages } = onboarding(t);
  document.querySelector('.open-preferences').click();
  assert.equal(document.body.dataset.step, '2');
  assert.equal(document.querySelector('#step-2').hidden, false);
  assert.equal(document.activeElement.id, 'enable-title');
  document.querySelectorAll('.open-preferences').forEach(button => { assert.equal(button.disabled, true); button.click(); });
  assert.deepEqual(messages, ['open-preferences']);
});

test('opening settings or claiming completion never shows success without Safari confirmation', t => {
  const { window, document, messages } = onboarding(t);
  document.querySelector('.open-preferences').click();
  window.finishOpeningPreferences('Opened.', false);
  assert.equal(document.body.dataset.step, '2');
  document.querySelector('.check-state').click();
  assert.deepEqual(messages, ['open-preferences', 'check-state']);
  assert.equal(document.body.dataset.step, '2');
  window.show(false);
  assert.equal(document.body.dataset.step, '2');
  assert.equal(document.querySelector('.check-state').disabled, false);
  window.show(null);
  assert.equal(document.body.dataset.step, '2');
  assert.match(document.querySelector('.waiting').textContent, /couldn’t confirm/);
});

test('verified activation shows success, hides setup help, and opens the selected site', t => {
  const { window, document, messages } = onboarding(t);
  window.show(true);
  assert.equal(document.body.dataset.step, '3');
  assert.equal(document.querySelector('#step-3').hidden, false);
  assert.equal(document.querySelector('details').hidden, true);
  assert.equal(document.querySelectorAll('[aria-current="step"]').length, 1);
  document.querySelector('[data-site="facebook"]').click();
  document.querySelector('[data-site="youtube"]').click();
  assert.deepEqual(messages, ['open-facebook', 'open-youtube']);
  window.show(false);
  assert.equal(document.body.dataset.step, '2');
  document.querySelector('[data-site="youtube"]').click();
  assert.equal(messages.length, 2);
});

test('setup guide remains available for enabled users without polling stealing focus', t => {
  const { window, document } = onboarding(t);
  window.show(true);
  document.querySelector('.view-guide').click();
  window.show(true);
  assert.equal(document.body.dataset.step, '1');
  assert.equal(document.activeElement.id, 'welcome-title');
  document.querySelector('.open-preferences').click();
  window.finishOpeningPreferences('Opened.', false);
  assert.equal(document.body.dataset.step, '3');
});

test('errors are readable text, reveal recovery instructions, and allow retry', t => {
  const { window, document, messages } = onboarding(t);
  document.querySelector('.open-preferences').click();
  const message = '<img src=x onerror="throw 1">';
  window.finishOpeningPreferences(message, true);
  const feedback = document.querySelector('.feedback');
  assert.equal(feedback.textContent, message);
  assert.equal(feedback.children.length, 0);
  assert.equal(document.querySelector('details').open, true);
  document.querySelector('#step-2 .open-preferences').click();
  assert.equal(messages.length, 2);
  window.finishOpeningPreferences('Opened.', false);
  assert.equal(feedback.textContent, '');
  assert.equal(document.querySelector('details').open, false);
});

test('a late Settings error cannot override activation confirmed by Safari', t => {
  const { window, document } = onboarding(t);
  document.querySelector('.open-preferences').click();
  window.show(true);
  window.finishOpeningPreferences('Extension not found in earlier request.', true);
  assert.equal(document.body.dataset.step, '3');
  assert.equal(document.querySelector('.feedback').textContent, '');
  assert.equal(document.querySelector('details').open, false);
});

test('website launch errors stay visible on the verified completion screen', t => {
  const { window, document, messages } = onboarding(t);
  window.show(true);
  window.showWebsiteError('Could not open YouTube in Safari.');
  assert.equal(document.body.dataset.step, '3');
  assert.equal(document.querySelector('.feedback').textContent, 'Could not open YouTube in Safari.');
  document.querySelector('[data-site="youtube"]').click();
  assert.equal(document.querySelector('.feedback').textContent, '');
  assert.deepEqual(messages, ['open-youtube']);
});
