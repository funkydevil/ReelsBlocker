//
//  ViewController.swift
//  ReelsBlocker
//
//  Created by K on 30/10/2026.
//

import Cocoa
import SafariServices
import WebKit

let extensionBundleIdentifier = "local.reelsblocker.Extension"

class ViewController: NSViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!
    private var isOpeningPreferences = false
    private var stateTimer: Timer?
    private var isCheckingState = false
    private var hasPositionedWindow = false
    private var windowChrome: NSView?

    override func viewDidAppear() {
        super.viewDidAppear()
        configureWindow()
        if !hasPositionedWindow {
            positionSetupWindow()
            hasPositionedWindow = true
        }
    }

    private func configureWindow() {
        guard let window = view.window else { return }
        window.title = AppLocalization.text("appName")
        window.styleMask = [.borderless, .closable]
        window.isOpaque = false
        window.backgroundColor = .clear
        window.hasShadow = true
        view.wantsLayer = true
        view.layer?.cornerRadius = 20
        view.layer?.masksToBounds = true
        guard windowChrome == nil else { return }
        let chrome = SetupDragRegion(frame: NSRect(x: 0, y: view.bounds.height - 24,
                                                   width: view.bounds.width, height: 24))
        chrome.autoresizingMask = [.width, .minYMargin]
        let close = SetupCloseButton(frame: NSRect(x: view.bounds.width - 36,
                                                   y: view.bounds.height - 32, width: 24, height: 24))
        close.autoresizingMask = [.minXMargin, .minYMargin]
        close.isBordered = false
        close.title = ""
        close.toolTip = AppLocalization.text("closeWindow")
        close.focusRingType = .exterior
        close.setAccessibilityLabel(AppLocalization.text("closeWindow"))
        close.target = self
        close.action = #selector(closeSetup)
        close.keyEquivalent = "\u{1b}"
        close.keyEquivalentModifierMask = []
        view.addSubview(chrome, positioned: .above, relativeTo: webView)
        view.addSubview(close, positioned: .above, relativeTo: chrome)
        windowChrome = chrome
    }

    @objc private func closeSetup() {
        NSApplication.shared.terminate(nil)
    }

    private func positionSetupWindow() {
        guard let window = view.window, let screen = window.screen ?? NSScreen.main else { return }
        let area = screen.visibleFrame.insetBy(dx: 16, dy: 16)
        var frame = NSRect(origin: .zero, size: NSSize(width: min(300, area.width), height: min(300, area.height)))
        let proposedX = area.midX - frame.width / 2 + area.width * 0.10
        frame.origin = NSPoint(x: min(max(proposedX, area.minX), area.maxX - frame.width),
                               y: area.midY - frame.height / 2)
        window.setFrame(frame, display: true)
        window.level = .floating
        window.hidesOnDeactivate = false
        window.collectionBehavior = [.moveToActiveSpace, .fullScreenAuxiliary]
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        let localeScript = WKUserScript(source: "window.__APP_LOCALE__ = '\(AppLocalization.locale)';",
                                        injectionTime: .atDocumentStart, forMainFrameOnly: true)
        webView.configuration.userContentController.addUserScript(localeScript)
        self.webView.navigationDelegate = self

        self.webView.configuration.userContentController.add(self, name: "controller")

        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)

        NotificationCenter.default.addObserver(self, selector: #selector(refreshExtensionState),
                                               name: NSApplication.didBecomeActiveNotification, object: nil)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        refreshExtensionState()
    }

    @objc private func refreshExtensionState() {
        guard !isCheckingState else { return }
        isCheckingState = true
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { [weak self] state, error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                self.isCheckingState = false
                if error == nil && state?.isEnabled == true {
                    self.stateTimer?.invalidate()
                    self.stateTimer = nil
                }
                let enabled = error == nil ? state.map { String($0.isEnabled) } ?? "null" : "null"
                self.webView.evaluateJavaScript("show(\(enabled))")
            }
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, let action = message.body as? String else { return }
        switch action {
        case "setup-step-1", "setup-step-2", "setup-step-3", "setup-step-4":
            return
        case "close-setup":
            closeSetup()
            return
        case "check-state":
            refreshExtensionState()
            return
        case "open-facebook":
            openWebsite("https://www.facebook.com/")
            return
        case "open-youtube":
            openWebsite("https://www.youtube.com/")
            return
        case "open-preferences":
            guard !isOpeningPreferences else { return }
        default:
            return
        }

        isOpeningPreferences = true
        positionSetupWindow()
        startCheckingState()
        webView.evaluateJavaScript("setOpeningPreferences(true)")

        // Launch Safari explicitly, even when another browser is the default.
        guard let safariURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.apple.Safari") else {
            finishOpeningPreferences(error: NSError(domain: "ReelsBlocker", code: 1,
                userInfo: [NSLocalizedDescriptionKey: AppLocalization.text("safariNotFound")]))
            return
        }

        NSWorkspace.shared.openApplication(at: safariURL, configuration: NSWorkspace.OpenConfiguration()) { [weak self] _, error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                if let error = error {
                    self.finishOpeningPreferences(error: error)
                } else {
                    self.showExtensionPreferences(retriesRemaining: 4)
                }
            }
        }
    }

    private func showExtensionPreferences(retriesRemaining: Int) {
        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { [weak self] error in
            DispatchQueue.main.async {
                guard let self = self else { return }
                // Safari may still be loading its extension registry after launch.
                if error != nil && retriesRemaining > 0 {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1) { [weak self] in
                        self?.showExtensionPreferences(retriesRemaining: retriesRemaining - 1)
                    }
                } else {
                    self.finishOpeningPreferences(error: error)
                }
            }
        }
    }

    private func finishOpeningPreferences(error: Error?) {
        isOpeningPreferences = false
        let message: String
        if let error = error {
            let nativeError = error as NSError
            message = nativeError.domain == SFErrorDomain && nativeError.code == SFErrorCode.noExtensionFound.rawValue
                ? AppLocalization.text("extensionNotFound")
                : AppLocalization.text("settingsOpenError")
            NSLog("Safari extension settings failed: %@", nativeError)
        } else {
            message = ""
        }
        // Encode native error text as data, never as executable JavaScript.
        if let data = try? JSONSerialization.data(withJSONObject: [message]),
           let arguments = String(data: data, encoding: .utf8) {
            webView.evaluateJavaScript("finishOpeningPreferences(\(arguments)[0], \(error != nil))")
        }
        refreshExtensionState()
    }

    private func startCheckingState() {
        stateTimer?.invalidate()
        // Keep checking even if opening Settings fails: the user may open it manually.
        stateTimer = Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { [weak self] _ in
            self?.refreshExtensionState()
        }
    }

    private func openWebsite(_ address: String) {
        guard let url = URL(string: address),
              let safariURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.apple.Safari") else { return }
        // The demo must open in Safari, where this extension is installed.
        view.window?.level = .normal
        NSWorkspace.shared.open([url], withApplicationAt: safariURL,
                                configuration: NSWorkspace.OpenConfiguration()) { [weak self] _, error in
            guard let error = error else { return }
            DispatchQueue.main.async {
                NSLog("Opening website in Safari failed: %@", error as NSError)
                let message = AppLocalization.text("websiteError")
                if let data = try? JSONSerialization.data(withJSONObject: [message]),
                   let arguments = String(data: data, encoding: .utf8) {
                    self?.webView.evaluateJavaScript("showWebsiteError(\(arguments)[0])")
                }
            }
        }
    }

    deinit {
        stateTimer?.invalidate()
        NotificationCenter.default.removeObserver(self)
    }
}
