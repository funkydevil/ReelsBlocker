# Reels Blocker for Facebook and YouTube

A Safari Web Extension for **macOS** that hides Facebook feed videos and images and blocks YouTube Shorts. Choose what to block using three independent checkboxes in the extension's toolbar popup. Regular YouTube videos, live streams, and embedded players remain available.

## Features

- **Videos:** hide video posts and stop playback, including Reels and live streams.
- **Images:** hide images while keeping post text visible.
- **Reels:** hide Reel links and cards, cancel navigation, and show a blocking screen on direct Reel pages when video blocking is enabled.
- **YouTube Shorts:** hide Shorts cards, shelves, and navigation links, cancel Shorts clicks, and stop playback on direct `/shorts/` pages. Regular YouTube videos and images are unaffected by the Facebook settings.
- **Live settings:** changes apply to open Facebook and YouTube tabs without reloading. All three options are enabled by default and saved locally.
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

The build script uses the Xcode project's Apple Development signing. This checkout uses the owner's personal development team; contributors should select their own team in Xcode. It uses a centralized DerivedData directory under `~/Library/Developer/Xcode/DerivedData/Codex/`, with a stable path for each checkout. If the local Codex path helper is installed, the script uses it to manage cache ownership.

To override the Apple Development certificate, set `REELSBLOCKER_SIGNING_IDENTITY` to its name and `REELSBLOCKER_DEVELOPMENT_TEAM` to its matching team ID when running the script. The script rejects ad-hoc signing (`-`) for these bundle IDs: mixing an unsigned Xcode copy with a developer-signed copy can break Safari's extension ownership lookup, including reading the enabled checkbox.

Xcode writes the final app directly to `dist`, while intermediates and caches stay in the centralized DerivedData directory. The script registers that app with Launch Services. Avoid keeping another installed copy with the same bundle identifier: conflicting containing-app registrations can cause `SFErrorDomain 1` even when the extension appears in Safari's list.

If that error persists, check old Xcode build locations and the Trash for other copies before reinstalling. During local validation, removing stale Launch Services registrations for those copies restored both extension-state lookup and the settings button across repeated app launches.

## Enable in Safari

1. Open `dist/ReelsBlocker.app` at least once to register the extension.
2. Use the app's **Open Safari Extension Settings** button.
3. In **Safari → Settings → Extensions**, enable **Reels Blocker for Facebook** and allow access to `facebook.com` and `youtube.com`.
4. Reload your open Facebook and YouTube tabs.

This local development build is not notarized or published in the App Store. Distribution requires appropriate Apple Developer signing. Unsigned builds made outside this script require Safari's developer option to allow unsigned extensions, which may reset after restarting Safari.

The app's **Open Safari Extension Settings** button launches Safari explicitly and opens this extension's settings. The app stays open so you can retry if Safari reports an error; returning to the app refreshes the enabled status. If the extension is missing, expand **Can’t find the extension?** for setup instructions. Keep one installed copy in Applications and launch that copy. Safari discovers the extension from its containing app; dragging the app icon into Safari's Extensions list is not an installation method.

The containing app uses a compact 300×300 point window with four Russian-language screens: introduction, opening Safari settings, a close-up illustration of the extension checkbox, and completion with a reminder about website access. **Чек на месте. Давай дальше** requests a fresh Safari check; the user's claim alone cannot advance to completion. Already enabled users follow the same explicit sequence. Facebook and YouTube buttons open their sites in Safari. Enabled status does not confirm website permissions or individual blocking options.

The setup window is positioned at the right of its screen, within the visible area above the Dock. It remains visible above Safari while the user enables the extension. Opening a test website returns it to the normal window level. The arrow currently points to the checkbox in the illustration inside the app; it does not locate or point to the live Safari control. Precise cross-application anchoring would require Accessibility access, which is not available to this sandboxed build.

See Apple's guides to [enabling developer features](https://developer.apple.com/documentation/safari-developer-tools/enabling-developer-features) and [running a Safari Web Extension](https://developer.apple.com/documentation/safariservices/running-your-safari-web-extension).

## Settings

Click **Reels Blocker** in Safari's toolbar. If needed, find it in Safari's extensions menu or customize the toolbar to show it.

- **Facebook videos:** block feed videos, Reels, and live streams.
- **Facebook images:** hide feed images and leave post text visible.
- **YouTube Shorts:** block Shorts only; ordinary YouTube playback remains available, including short videos opened through normal `/watch` URLs.

There is no Save button: changes are stored immediately. After updating the app, toggle the extension off and on and reload Facebook and YouTube once to load the new content script. If Safari keeps the old version, quit Safari with **⌘Q** and reopen it, then allow unsigned extensions again if needed. Approve the local storage permission if Safari requests it.

## Privacy and limitations

The extension only runs on Facebook and YouTube websites, including mobile subdomains. It does not affect their native apps. It has no analytics, background service, or extension-initiated network requests. Settings use local extension storage.

Blocking hides page elements and stops playback. Facebook may begin downloading media before the content script blocks it. Image blocking covers HTML images, SVG image elements, and inline `background-image` URLs; background images defined only in external stylesheets are not detected.

Facebook and YouTube can change their markup. New post formats may require selector updates, so this is not a guarantee that every future video or image format will be recognized.

## Verification

Automated checks cover URL matching, dynamic content, recycled posts, single-page navigation, playback prevention, all four combinations of settings, cross-tab updates, popup persistence, storage write failures, YouTube Shorts cards and direct pages, and preservation of normal YouTube playback. Tests use prepared DOM fixtures and a mock extension storage API.

The macOS Debug app builds successfully and passes `codesign --verify --deep --strict`. The blocking screen and settings panel have been inspected in Chromium using prepared pages. These checks do not establish that the installed extension works on signed-in Facebook and YouTube pages in Safari; that remains a manual acceptance check.

### Manual Safari checklist

- With both options enabled, verify that videos and images disappear while text remains readable and video sound stops.
- Try all four combinations of video and image blocking; verify immediate changes and persistence after reopening the popup.
- Scroll to load new posts and check that the selected policy still applies.
- With video blocking enabled, open `https://www.facebook.com/reels/` and `/reel/<id>` links; verify the blocking screen and stopped playback.
- Disable video blocking and verify that Reel navigation is available again.
- Check private messages, floating chat dialogs, Back/Forward navigation, and new tabs.

- Enable **YouTube Shorts** and check home, search, subscriptions, and channel pages: Shorts should disappear while ordinary video cards stay visible.
- Open a direct `/shorts/<id>` URL: verify the blocking screen and stopped sound. Return to a normal `/watch?v=<id>` video and confirm playback works, including after Back/Forward navigation.
- Toggle **YouTube Shorts** off and on; check restoration, persistence, and independence from Facebook settings.
- On YouTube, verify normal videos, live streams, images, and embedded players remain usable with every Facebook setting combination.
