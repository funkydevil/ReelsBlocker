# Reels Blocker for Facebook

A Safari Web Extension for **macOS** that hides videos and images in your Facebook feed. Choose what to block using two independent checkboxes in the extension's toolbar popup.

## Features

- **Videos:** hide video posts and stop playback, including Reels and live streams.
- **Images:** hide images while keeping post text visible.
- **Reels:** hide Reel links and cards, cancel navigation, and show a blocking screen on direct Reel pages when video blocking is enabled.
- **Live settings:** changes apply to open Facebook tabs without reloading. Both options are enabled by default and saved locally.
- **Dynamic feeds:** handle newly loaded posts, reused elements, and navigation without a full page reload.

Videos and images in private messages and floating chat dialogs are excluded from the feed policy. Turning blocking off restores hidden content; previously paused videos must be started manually.

## Requirements

- macOS 13 or later and Safari with Manifest V3 support.
- Xcode with macOS development tools to build the containing app.
- Node.js 22 or later and npm to run the development checks and tests.
- Python 3 for the optional local DerivedData path helper.

## Build

```sh
npm ci
npm run check
npm test
zsh scripts/build-macos.sh
```

The app is written to `dist/ReelsBlocker.app`. Build products, dependencies, and personal Xcode state are excluded from Git.

The Xcode project is `Safari/ReelsBlocker/ReelsBlocker.xcodeproj`. It references the original files in `extension/`, so no resource copying is needed after editing them.

The build script creates an ad-hoc signed Debug app. It uses a centralized DerivedData directory under `~/Library/Developer/Xcode/DerivedData/Codex/`, with a stable path for each checkout. If the local Codex path helper is installed, the script uses it to manage cache ownership.

## Enable in Safari

1. Open `dist/ReelsBlocker.app` at least once to register the extension.
2. In **Safari → Settings → Advanced**, enable **Show features for web developers**.
3. Open the **Developer** settings tab and enable **Allow unsigned extensions**. In some Safari versions, this option appears in the **Develop** menu.
4. In **Safari → Settings → Extensions**, enable **Reels Blocker for Facebook** and allow access to `facebook.com`.
5. Reload your open Facebook tabs.

Unsigned extensions may need to be allowed again after restarting Safari. This local build is not notarized or published in the App Store. Distribution requires appropriate Apple Developer signing.

See Apple's guides to [enabling developer features](https://developer.apple.com/documentation/safari-developer-tools/enabling-developer-features) and [running a Safari Web Extension](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension).

## Settings

Click **Reels Blocker** in Safari's toolbar. If needed, find it in Safari's extensions menu or customize the toolbar to show it.

- **Videos:** block feed videos, Reels, and live streams.
- **Images:** hide feed images and leave post text visible.

There is no Save button: changes are stored immediately. After updating the app, toggle the extension off and on and reload Facebook once to load the new content script. If Safari keeps the old version, quit Safari with **⌘Q** and reopen it, then allow unsigned extensions again if needed. Approve the local storage permission if Safari requests it.

## Privacy and limitations

The extension only runs on Facebook websites, including mobile subdomains. It does not affect the native Facebook app. It has no analytics, background service, or extension-initiated network requests. Settings use local extension storage.

Blocking hides page elements and stops playback. Facebook may begin downloading media before the content script blocks it. Image blocking covers HTML images, SVG image elements, and inline `background-image` URLs; background images defined only in external stylesheets are not detected.

Facebook can change its markup. New post formats may require selector updates, so this is not a guarantee that every future video or image format will be recognized.

## Verification

Automated checks cover URL matching, dynamic content, recycled posts, single-page navigation, playback prevention, all four combinations of settings, cross-tab updates, popup persistence, and storage write failures. Tests use prepared DOM fixtures and a mock extension storage API.

The macOS Debug app builds successfully and passes `codesign --verify --deep --strict`. The blocking screen and settings panel have been inspected in Chromium using prepared pages. These checks do not establish that the installed extension works on a signed-in Facebook feed in Safari; that remains a manual acceptance check.

### Manual Safari checklist

- With both options enabled, verify that videos and images disappear while text remains readable and video sound stops.
- Try all four combinations of video and image blocking; verify immediate changes and persistence after reopening the popup.
- Scroll to load new posts and check that the selected policy still applies.
- With video blocking enabled, open `https://www.facebook.com/reels/` and `/reel/<id>` links; verify the blocking screen and stopped playback.
- Disable video blocking and verify that Reel navigation is available again.
- Check private messages, floating chat dialogs, Back/Forward navigation, and new tabs.
