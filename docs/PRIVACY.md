# Short Video Blocker Privacy Policy

Effective date: 2 November 2026

Short Video Blocker is a Safari extension for macOS, developed by Kirill Piulziu.

## Local filtering and settings

Filtering works locally on your Mac. The app contains no advertising, account system, or developer-operated filtering server. Product analytics is described below. It is enabled by default and can be disabled in the extension settings.

The extension reads and changes the supported Facebook and YouTube pages locally in Safari to identify and hide the media you choose to block. Page content, browsing history, searches, messages, account details, and media are not sent to the developer or stored by the extension. The extension does not request your Facebook or YouTube password.

## Settings

Your three filter preferences are stored locally using Safari extension storage. They are used only to remember which filters you enabled. You can change them in the extension menu. Removing the extension through Safari removes its extension storage according to Safari's own storage management.

## PostHog product analytics

Product analytics is enabled by default. To turn it off, open the extension menu in Safari, choose Settings, and switch off “Share anonymous usage to improve the app”. One shared preference controls analytics from both the app and extension. This preference and a random analytics identifier are stored in the macOS Keychain access group shared by the app and its native extension.

While enabled, the app sends explicit product interactions (such as setup steps, extension activation results, opening the settings popup, and changing a filter), app version, interface language, and a randomly generated installation identifier to PostHog EU Cloud. This identifier is not your name, email, website account, hardware identifier, or advertising identifier. These events help the developer understand setup completion and which filters are useful. They are not used for advertising or cross-company tracking.

We do not send page content, visited-page addresses, browsing history, Facebook or YouTube account information, names, emails, messages, media, session recordings, or automatic click recordings. Person profiles and geolocation enrichment are disabled. As with any internet request, PostHog receives the network connection needed to deliver events; the PostHog project is configured to discard client IP data, and event geolocation enrichment is disabled.

You can turn sharing off at any time in the extension menu → Settings. This prevents future events and clears the shared local analytics identifier. Requests already being delivered may complete. Events already received by PostHog are not automatically deleted by turning sharing off. For questions about analytics data, contact support. See [PostHog’s privacy policy](https://posthog.com/privacy).

## Website access

Safari asks you to allow access to supported websites so the extension can hide content on those pages. You control that access in Safari Settings. The Facebook and YouTube websites continue to communicate with their own services under their respective privacy policies. Hiding a page element does not guarantee that the website will stop every underlying network request or media download.

## Apple and support

Apple handles App Store downloads and any system diagnostics under Apple's privacy policies. If you choose to contact support through GitHub, the information you submit is handled by GitHub and is visible according to the issue's access settings. Do not include passwords, private browsing information, or other sensitive data in a public issue.

## Changes and contact

This policy will be updated if the app's privacy practices change. For questions, use [the support issue tracker](https://github.com/funkydevil/ReelsBlocker/issues).
