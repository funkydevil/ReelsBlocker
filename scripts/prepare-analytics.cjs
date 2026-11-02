'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const file = path.join(root, '.posthog/config.json');
const config = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
if (config.host && config.host !== 'https://eu.i.posthog.com') throw new Error('Unexpected analytics host');
fs.writeFileSync(path.join(root, 'extension/analytics-config.json'),
  JSON.stringify({ token: config.token || '', host: 'https://eu.i.posthog.com' }) + '\n');
console.log(config.token ? 'PostHog EU configuration prepared.' : 'PostHog unconfigured; analytics disabled.');
