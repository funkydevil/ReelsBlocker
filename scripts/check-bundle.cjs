'use strict';
const fs = require('node:fs');
const path = require('node:path');
const app = path.resolve(process.argv[2] || path.join(__dirname, '../dist/Short Video Blocker.app'));
const resources = path.join(app, 'Contents/PlugIns/Short Video Blocker Extension.appex/Contents/Resources');
const manifest = JSON.parse(fs.readFileSync(path.join(resources, 'manifest.json'), 'utf8'));
const files = [manifest.action.default_popup, ...Object.values(manifest.icons), ...(manifest.background?.scripts || [])];
for (const script of manifest.content_scripts) files.push(...script.js, ...(script.css || []));
for (const file of files) {
  if (!fs.existsSync(path.join(resources, file))) throw Error('Missing packaged extension resource: ' + file);
}
const popup = fs.readFileSync(path.join(resources, manifest.action.default_popup), 'utf8');
for (const match of popup.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if (!match[1].includes('://') && !fs.existsSync(path.join(resources, match[1]))) throw Error('Missing packaged popup resource: ' + match[1]);
}
console.log('Packaged manifest, background, content and popup resources verified.');
