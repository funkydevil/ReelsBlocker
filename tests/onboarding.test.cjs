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
function openSettings(app) {
  app.document.querySelector('.start').click();
  app.document.querySelector('.open-preferences').click();
}
test('four steps advance through explicit actions, even for already enabled users', t => {
  const app = onboarding(t), { window, document, messages } = app;
  window.show(true);
  assert.equal(document.body.dataset.step, '1');
  openSettings(app);
  assert.equal(document.body.dataset.step, '2');
  document.querySelector('.open-preferences').click();
  assert.equal(messages.filter(x => x === 'open-preferences').length, 1);
  window.finishOpeningPreferences('', false);
  assert.equal(document.body.dataset.step, '3');
  window.show(true);
  assert.equal(document.body.dataset.step, '3');
  document.querySelector('.check-state').click();
  assert.equal(document.body.dataset.step, '3');
  window.show(true);
  assert.equal(document.body.dataset.step, '4');
  assert.equal(document.activeElement.id, 'done-title');
});
test('claiming a checkbox is checked cannot bypass Safari verification', t => {
  const app = onboarding(t), { window, document } = app;
  openSettings(app); window.finishOpeningPreferences('', false);
  for (const state of [false, null]) {
    document.querySelector('.check-state').click();
    window.show(state);
    assert.equal(document.body.dataset.step, '3');
    assert.equal(document.querySelector('.check-state').disabled, false);
    assert.notEqual(document.querySelector('.feedback').textContent, '');
  }
});
test('errors stay compact text and allow retry without leaving the settings step', t => {
  const app = onboarding(t), { window, document } = app;
  openSettings(app);
  const error = '<img src=x onerror="throw 1">';
  window.finishOpeningPreferences(error, true);
  assert.equal(document.body.dataset.step, '2');
  assert.equal(document.querySelector('.feedback').textContent, error);
  assert.equal(document.querySelector('.feedback').children.length, 0);
  assert.equal(document.querySelector('.open-preferences').disabled, false);
  document.querySelector('.open-preferences').click();
  window.finishOpeningPreferences('', false);
  assert.equal(document.body.dataset.step, '3');
});
test('back navigation does not let a late Settings callback replace the current screen', t => {
  const app = onboarding(t), { window, document } = app;
  openSettings(app); window.finishOpeningPreferences('', false);
  document.querySelector('.back').click();
  document.querySelector('.back').click();
  assert.equal(document.body.dataset.step, '1');
  window.finishOpeningPreferences('Late error', true);
  assert.equal(document.body.dataset.step, '1');
  assert.equal(document.querySelector('.feedback').textContent, '');
});
test('verified completion opens sites in Safari and displays launch errors', t => {
  const app = onboarding(t), { window, document, messages } = app;
  openSettings(app); window.finishOpeningPreferences('', false);
  document.querySelector('[data-site="youtube"]').click();
  assert.equal(messages.includes('open-youtube'), false);
  document.querySelector('.check-state').click(); window.show(true);
  document.querySelector('[data-site="facebook"]').click();
  document.querySelector('[data-site="youtube"]').click();
  assert.equal(messages.includes('open-facebook'), true);
  assert.equal(messages.includes('open-youtube'), true);
  window.showWebsiteError('Не удалось открыть сайт.');
  assert.equal(document.querySelector('.feedback').textContent, 'Не удалось открыть сайт.');
});

test('finish closes only from the completed step', t => {
  const app = onboarding(t), { window, document, messages } = app;
  document.querySelector('.finish').click();
  assert.equal(messages.includes('close-setup'), false);
  openSettings(app); window.finishOpeningPreferences('', false);
  document.querySelector('.check-state').click(); window.show(true);
  document.querySelector('.finish').click();
  assert.equal(messages.at(-1), 'close-setup');
});
