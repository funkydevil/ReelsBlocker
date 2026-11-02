const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const catalog = JSON.parse(read('localization/catalog.json'));
const locales = ['en', 'ru', 'pt_PT', 'es', 'fr', 'de', 'it', 'nl', 'pl', 'uk', 'tr', 'ja', 'ko', 'zh_CN', 'ar'];
const runtime = read('extension/i18n.js');
const onboardingHTML = read('Safari/ReelsBlocker/ReelsBlocker/Resources/Base.lproj/Main.html');
const onboardingScript = read('Safari/ReelsBlocker/ReelsBlocker/Resources/Script.js');
const popupHTML = read('extension/popup.html');
const popupScript = read('extension/popup.js');
const flush = () => new Promise(resolve => setImmediate(resolve));

function page(t, html, { nativeLocale, browserLocale, languages = ['en-US'], browserThrows = false } = {}) {
  const dom = new JSDOM(html, { runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  Object.defineProperty(dom.window.navigator, 'languages', { configurable: true, value: languages });
  Object.defineProperty(dom.window.navigator, 'language', { configurable: true, value: languages[0] });
  if (nativeLocale) dom.window.__APP_LOCALE__ = nativeLocale;
  dom.window.browser = { i18n: { getUILanguage() {
    if (browserThrows) throw new Error('Locale API unavailable');
    return browserLocale;
  } } };
  dom.window.eval(runtime);
  return dom.window;
}

function assertMarkedTranslations(document, api, locale) {
  for (const element of document.querySelectorAll('[data-i18n]')) {
    const key = element.getAttribute('data-i18n');
    assert.ok(Object.hasOwn(catalog[locale], key), `${locale}: missing UI key ${key}`);
    const target = element.querySelector('[data-i18n-text]') || element;
    assert.equal(target.textContent, api.t(key), `${locale}: untranslated ${key}`);
  }
  for (const attribute of ['aria-label', 'title', 'placeholder']) {
    for (const element of document.querySelectorAll(`[data-i18n-${attribute}]`)) {
      const key = element.getAttribute(`data-i18n-${attribute}`);
      assert.ok(Object.hasOwn(catalog[locale], key), `${locale}: missing attribute key ${key}`);
      assert.equal(element.getAttribute(attribute), api.t(key), `${locale}: untranslated ${attribute}`);
    }
  }
}

function assertDocumentLocale(document, locale) {
  assert.equal(document.documentElement.lang, locale.replaceAll('_', '-'));
  assert.equal(document.documentElement.dir, locale === 'ar' ? 'rtl' : 'ltr');
}

test('all 15 onboarding locales translate real markup, accessibility labels and dynamic states', async t => {
  for (const locale of locales) await t.test(locale, t => {
    const window = page(t, onboardingHTML, { nativeLocale: locale, browserLocale: 'en-US' });
    const { document, AppI18n: api } = window;
    const messages = [];
    window.webkit = { messageHandlers: { controller: { postMessage: message => messages.push(message) } } };
    window.eval(onboardingScript);
    assert.equal(api.locale, locale);
    assertDocumentLocale(document, locale);
    assertMarkedTranslations(document, api, locale);
    assert.equal(document.title, catalog[locale].appName);
    assert.equal(document.querySelector('.step-count').getAttribute('aria-label'), api.t('stepLabel', { step: 1, total: 4 }));
    assert.equal(document.querySelector('.settings-crop img').getAttribute('src'), '../Icon.png');
    assert.ok(document.querySelector('.sample-checkbox .check-mark'), 'translation must preserve the animated checkmark');
    assert.ok(document.querySelector('.demo-cursor path'), 'translation must preserve the decorative cursor');
    assert.equal(document.querySelector('.checkbox-demo').getAttribute('aria-label'), api.t('exampleCheckboxLabel'));
    assert.ok(document.querySelector('[data-i18n="enableBody"]').textContent.includes(catalog[locale].appName));

    document.querySelector('.start').click();
    document.querySelector('.open-preferences').click();
    assert.equal(document.querySelector('.open-preferences').textContent, catalog[locale].openingSettings);
    window.finishOpeningPreferences('', false);
    assert.equal(document.body.dataset.step, '3');
    assert.equal(document.querySelector('.step-count').getAttribute('aria-label'), api.t('stepLabel', { step: 3, total: 4 }));
    assert.equal(document.querySelector('.replay-demo').textContent, catalog[locale].pauseDemo);
    document.querySelector('.replay-demo').click();
    assert.equal(document.querySelector('.replay-demo').textContent, catalog[locale].resumeDemo);
    assert.equal(document.querySelector('.replay-demo').getAttribute('aria-label'), catalog[locale].resumeDemoLabel);
    document.querySelector('.check-state').click();
    assert.equal(document.querySelector('.check-state').textContent, catalog[locale].checkingEnabled);
    window.show(false);
    assert.equal(document.querySelector('.feedback').textContent, catalog[locale].notEnabled);
    document.querySelector('.check-state').click();
    window.show(null);
    assert.equal(document.querySelector('.feedback').textContent, catalog[locale].stateUnknown);
    document.querySelector('.check-state').click();
    window.show(true);
    assert.equal(document.body.dataset.step, '4');
    assert.equal(document.querySelector('.finish').textContent, catalog[locale].finish);
    assert.equal(document.querySelector('[data-i18n="doneBody"]').textContent, catalog[locale].doneBody);
    document.querySelector('.finish').click();
    assert.equal(messages.at(-1), 'close-setup');
  });
});

test('all 15 popup locales preserve switches and localize loading, save success and rollback errors', async t => {
  for (const locale of locales) await t.test(locale, async t => {
    const window = page(t, popupHTML, { browserLocale: locale.replaceAll('_', '-'), languages: ['en-US'] });
    const { document, AppI18n: api } = window;
    api.apply();
    assert.equal(api.locale, locale);
    assertDocumentLocale(document, locale);
    assertMarkedTranslations(document, api, locale);
    assert.equal(document.querySelector('.brand-name').textContent, catalog[locale].appName);
    const stored = { blockVideos: true, blockImages: false, blockShorts: true };
    let failSave = false;
    window.browser.storage = { local: {
      async get(defaults) { return { ...defaults, ...stored }; },
      async set(change) {
        if (failSave) throw new Error('Storage unavailable');
        Object.assign(stored, change);
      }
    } };
    window.eval(popupScript);
    await flush();
    assert.equal(document.querySelector('fieldset').disabled, false);
    assert.equal(document.querySelector('#status').textContent, catalog[locale].settingsReady);
    const controls = {
      blockVideos: ['facebookVideos', 'facebookVideosDetail'],
      blockImages: ['facebookImages', 'facebookImagesDetail'],
      blockShorts: ['youtubeShorts', 'youtubeShortsDetail']
    };
    for (const [id, [label, detail]] of Object.entries(controls)) {
      const input = document.getElementById(id);
      assert.ok(input && input.type === 'checkbox', `missing ${id}`);
      assert.equal(input.checked, stored[id]);
      assert.equal(document.getElementById(input.getAttribute('aria-labelledby')).textContent, catalog[locale][label]);
      assert.equal(document.getElementById(input.getAttribute('aria-describedby')).textContent, catalog[locale][detail]);
      assert.ok(input.closest('label').querySelector('svg'), 'localization must retain the setting icon');
    }
    const images = document.getElementById('blockImages');
    images.checked = true;
    images.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(document.querySelector('#status').textContent, catalog[locale].savingSettings);
    await flush();
    assert.equal(stored.blockImages, true);
    assert.equal(document.querySelector('#status').textContent, catalog[locale].settingsSaved);
    failSave = true;
    images.checked = false;
    images.dispatchEvent(new window.Event('change', { bubbles: true }));
    await flush();
    assert.equal(images.checked, true, 'a failed localized save must roll back the switch');
    assert.equal(document.querySelector('#status').textContent, catalog[locale].settingsSaveError);
  });
});

test('locale selection supports native override, regional fallback and unavailable browser APIs', t => {
  const cases = [
    [{ nativeLocale: 'ru', browserLocale: 'de-DE', languages: ['fr-FR'] }, 'ru'],
    [{ browserLocale: 'fr-CA', languages: ['de-DE'] }, 'fr'],
    [{ languages: ['pt-BR'] }, 'pt_PT'],
    [{ languages: ['zh-Hant-TW'] }, 'zh_CN'],
    [{ languages: ['xx-YY', 'uk-UA'] }, 'uk'],
    [{ browserThrows: true, languages: ['ja-JP'] }, 'ja'],
    [{ languages: ['xx-YY'] }, 'en']
  ];
  for (const [preferences, locale] of cases) {
    const window = page(t, '<html><body><p data-i18n="start"></p></body></html>', preferences);
    assert.equal(window.AppI18n.locale, locale);
    window.AppI18n.apply();
    assert.equal(window.document.querySelector('p').textContent, catalog[locale].start);
    assertDocumentLocale(window.document, locale);
  }
});

test('the shared runtime leaves website markup untouched and safely translates owned text slots', t => {
  const window = page(t, '<html lang="en"><body><p data-i18n="start">Website content</p><button data-i18n="enableBody"><svg aria-hidden="true"><path/></svg><span data-i18n-text></span></button></body></html>', { nativeLocale: 'ar' });
  const { document, AppI18n: api } = window;
  assert.equal(document.documentElement.lang, 'en', 'loading a content script must not change the website language');
  assert.equal(document.querySelector('p').textContent, 'Website content');
  const button = document.querySelector('button');
  api.apply(button, { appName: '<img src=x onerror="throw 1">' });
  assert.ok(button.querySelector('svg path'), 'translation must preserve the icon outside its text slot');
  assert.equal(button.querySelectorAll('img').length, 0, 'interpolated text must never become HTML');
  assert.ok(button.querySelector('[data-i18n-text]').textContent.includes('<img src=x onerror="throw 1">'));
  assert.equal(document.querySelector('p').textContent, 'Website content', 'scoped apply must not touch siblings');
});

test('manifest messages, runtime catalog and native app names agree for every locale', () => {
  const manifest = JSON.parse(read('extension/manifest.json'));
  assert.deepEqual(Object.keys(catalog).sort(), [...locales].sort());
  assert.equal(manifest.default_locale, 'en');
  const references = [...JSON.stringify(manifest).matchAll(/__MSG_([A-Za-z0-9_]+)__/g)].map(match => match[1]);
  assert.ok(references.includes('appName'));
  assert.ok(references.includes('appDescription'));
  assert.ok(references.includes('toolbarTitle'));
  const englishKeys = Object.keys(catalog.en).sort();
  const interpolationKeys = value => [...new Set([...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(match => match[1]))].sort();
  for (const locale of locales) {
    const messages = JSON.parse(read(`extension/_locales/${locale}/messages.json`));
    assert.deepEqual(Object.keys(catalog[locale]).sort(), englishKeys);
    assert.deepEqual(Object.keys(messages).sort(), englishKeys);
    assert.ok(catalog[locale].appName.length > 0 && catalog[locale].appName.length <= 30);
    for (const key of englishKeys) {
      assert.equal(messages[key].message, catalog[locale][key], `${locale}.${key}: stale extension messages`);
      assert.deepEqual(interpolationKeys(catalog[locale][key]), interpolationKeys(catalog.en[key]), `${locale}.${key}: changed placeholders`);
    }
    for (const key of references) {
      assert.ok(messages[key]?.message.trim(), `${locale}: missing manifest message ${key}`);
      assert.ok(!/[{}]/.test(messages[key].message), `${locale}.${key}: manifest cannot interpolate runtime placeholders`);
    }
    const appleLocale = { pt_PT: 'pt-PT', zh_CN: 'zh-Hans' }[locale] || locale;
    const nativeNames = read(`localization/native/${appleLocale}.lproj/InfoPlist.strings`);
    assert.ok(nativeNames.includes(`"CFBundleDisplayName" = ${JSON.stringify(catalog[locale].appName)};`));
    assert.ok(nativeNames.includes(`"CFBundleName" = ${JSON.stringify(catalog[locale].appName)};`));
  }
});
