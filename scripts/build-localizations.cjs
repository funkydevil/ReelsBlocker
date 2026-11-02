#!/usr/bin/env node
'use strict';

// Edit localization/catalog.json, then run this file to regenerate both runtimes.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const checking = process.argv.includes('--check');
function writeGenerated(file, content) {
  if (checking) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) throw new Error(`Stale generated file: ${file}`);
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'localization/catalog.json'), 'utf8'));
const expectedLocales = ['en', 'ru', 'pt_PT', 'es', 'fr', 'de', 'it', 'nl', 'pl', 'uk', 'tr', 'ja', 'ko', 'zh_CN', 'ar'];
const locales = Object.keys(catalog);
const keys = Object.keys(catalog.en || {});
if (!keys.length || JSON.stringify([...locales].sort()) !== JSON.stringify([...expectedLocales].sort())) {
  throw new Error('The catalog must contain English and all 15 supported locales.');
}
const placeholders = text => [...new Set([...text.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map(match => match[1]))].sort();
for (const locale of locales) {
  const messages = catalog[locale];
  if (JSON.stringify(Object.keys(messages).sort()) !== JSON.stringify([...keys].sort())) {
    throw new Error(`${locale}: translation keys differ from English.`);
  }
  for (const key of keys) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key) || typeof messages[key] !== 'string' || !messages[key].trim()) {
      throw new Error(`${locale}.${key}: expected a nonempty string and a valid key.`);
    }
    if (/__BRAND__/.test(messages[key])) throw new Error(`${locale}.${key}: unresolved brand placeholder.`);
    if (JSON.stringify(placeholders(messages[key])) !== JSON.stringify(placeholders(catalog.en[key]))) {
      throw new Error(`${locale}.${key}: interpolation placeholders differ from English.`);
    }
  }
  if (messages.appName.length > 30) throw new Error(`${locale}: app name exceeds 30 characters.`);
  const directory = path.join(root, 'extension/_locales', locale);
  const extensionMessages = Object.fromEntries(keys.map(key => [key, { message: messages[key] }]));
  writeGenerated(path.join(directory, 'messages.json'), JSON.stringify(extensionMessages, null, 2) + '\n');
  const appleLocale = {pt_PT: 'pt-PT', zh_CN: 'zh-Hans'}[locale] || locale;
  const nativeName = JSON.stringify(messages.appName);
  writeGenerated(path.join(root, 'localization/native', appleLocale + '.lproj/InfoPlist.strings'),
    '"CFBundleDisplayName" = ' + nativeName + ';\n"CFBundleName" = ' + nativeName + ';\n');
}

function installI18n(global, catalog) {
  const localeMap = Object.fromEntries(Object.keys(catalog).map(locale => [locale.toLowerCase().replaceAll('_', '-'), locale]));
  function resolve(requested) {
    if (typeof requested !== 'string') return null;
    const normalized = requested.trim().toLowerCase().replaceAll('_', '-');
    if (localeMap[normalized]) return localeMap[normalized];
    const language = normalized.split('-')[0];
    if (language === 'pt') return 'pt_PT';
    if (language === 'zh') return 'zh_CN';
    return localeMap[language] || null;
  }
  const browserAPI = global.browser || global.chrome;
  let browserLocale;
  try { browserLocale = browserAPI?.i18n?.getUILanguage?.(); } catch { /* navigator is a sufficient fallback. */ }
  const preferred = [global.__APP_LOCALE__, browserLocale, ...(global.navigator?.languages || []), global.navigator?.language];
  const locale = preferred.map(resolve).find(Boolean) || 'en';
  const direction = locale === 'ar' ? 'rtl' : 'ltr';
  function t(key, variables = {}) {
    const template = catalog[locale][key] ?? catalog.en[key] ?? key;
    const values = { appName: catalog[locale].appName, ...variables };
    return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g,
      (placeholder, name) => values[name] == null ? placeholder : String(values[name]));
  }
  function apply(root = global.document, variables = {}) {
    if (!root?.querySelectorAll) return;
    const doc = root.nodeType === 9 ? root : root.ownerDocument;
    if (doc?.documentElement) {
      doc.documentElement.lang = locale.replaceAll('_', '-');
      doc.documentElement.dir = direction;
    }
    const selectors = '[data-i18n], [data-i18n-aria-label], [data-i18n-title], [data-i18n-placeholder]';
    const targets = [...root.querySelectorAll(selectors)];
    if (root.matches?.(selectors)) targets.unshift(root);
    for (const element of targets) {
      const key = element.getAttribute('data-i18n');
      if (key) {
        // Mark leaf spans, or provide a nested data-i18n-text slot to retain icons/controls.
        const slot = element.querySelector('[data-i18n-text]') || element;
        slot.textContent = t(key, variables);
      }
      for (const attribute of ['aria-label', 'title', 'placeholder']) {
        const attributeKey = element.getAttribute('data-i18n-' + attribute);
        if (attributeKey) element.setAttribute(attribute, t(attributeKey, variables));
      }
    }
  }
  // Deliberately no automatic document mutation: this helper also loads on supported websites.
  global.AppI18n = Object.freeze({ locale, direction, t, apply, supportedLocales: Object.freeze(Object.keys(catalog)) });
}
const source = '// Generated from localization/catalog.json. Do not edit; run node scripts/build-localizations.cjs.\n'
  + '(' + installI18n.toString() + ')(globalThis, ' + JSON.stringify(catalog) + ');\n';
writeGenerated(path.join(root, 'extension/i18n.js'), source);
console.log(`Generated ${locales.length} locales with ${keys.length} messages each.`);
