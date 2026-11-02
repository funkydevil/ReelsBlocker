'use strict';
// Reuse existing local Mac App Store profiles/certificates; no portal mutations.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync: run } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const app = path.resolve(process.argv[2] || path.join(root, 'dist/Short Video Blocker.app'));
const profiles = process.env.REELSBLOCKER_PROFILE_DIR || path.join(root, 'dist/signing');
const signingIdentity = '3rd Party Mac Developer Application: Kirill Piulziu (F93NU8DF46)';
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'svb-sign-'));
for (const [role, bundle] of [['extension', path.join(app, 'Contents/PlugIns/Short Video Blocker Extension.appex')], ['app', app]]) {
  const source = path.join(profiles, role + '.entitlements');
  const entitlements = JSON.parse(run('plutil', ['-convert', 'json', '-o', '-', source], { encoding: 'utf8' }));
  entitlements['keychain-access-groups'] = ['F93NU8DF46.local.reelsblocker.analytics'];
  entitlements['com.apple.security.network.client'] = true;
  const output = path.join(temp, role + '.plist');
  fs.writeFileSync(output, JSON.stringify(entitlements));
  run('plutil', ['-convert', 'xml1', output]);
  fs.copyFileSync(path.join(profiles, role + '.provisionprofile'), path.join(bundle, 'Contents/embedded.provisionprofile'));
  run('codesign', ['--force', '--sign', signingIdentity, '--entitlements', output, bundle], { stdio: 'inherit' });
}
run('codesign', ['--verify', '--deep', '--strict', app], { stdio: 'inherit' });
console.log('Signed using existing local Mac App Store profiles.');
