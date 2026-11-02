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

    override func viewDidLoad() {
        super.viewDidLoad()

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
        webView.evaluateJavaScript("setOpeningPreferences(true)")

        // Launch Safari explicitly, even when another browser is the default.
        guard let safariURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.apple.Safari") else {
            finishOpeningPreferences(error: NSError(domain: "ReelsBlocker", code: 1,
                userInfo: [NSLocalizedDescriptionKey: "Safari could not be found on this Mac."]))
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
            let reason = nativeError.domain == SFErrorDomain && nativeError.code == SFErrorCode.noExtensionFound.rawValue
                ? "Safari cannot match Reels Blocker to this app. Keep one installed copy and open it again. If using an unsigned build, allow unsigned extensions in Safari's Developer settings. "
                : "Could not open the extension settings. "
            message = reason + "In Safari, choose Safari → Settings → Extensions. "
                + "If Reels Blocker is missing, follow the steps below. "
                + "\(nativeError.localizedDescription) (\(nativeError.domain), \(nativeError.code))"
            NSLog("Safari extension settings failed: %@", nativeError)
        } else {
            message = "Safari extension settings are open. Select Reels Blocker and enable its checkbox."
        }
        // Encode native error text as data, never as executable JavaScript.
        if let data = try? JSONSerialization.data(withJSONObject: [message]),
           let arguments = String(data: data, encoding: .utf8) {
            webView.evaluateJavaScript("finishOpeningPreferences(\(arguments)[0], \(error != nil))")
        }
        refreshExtensionState()
        if error == nil {
            stateTimer?.invalidate()
            stateTimer = Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { [weak self] _ in
                self?.refreshExtensionState()
            }
        }
    }

    private func openWebsite(_ address: String) {
        guard let url = URL(string: address),
              let safariURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.apple.Safari") else { return }
        // The demo must open in Safari, where this extension is installed.
        NSWorkspace.shared.open([url], withApplicationAt: safariURL,
                                configuration: NSWorkspace.OpenConfiguration()) { [weak self] _, error in
            guard let error = error else { return }
            DispatchQueue.main.async {
                let message = "Could not open the site in Safari. \(error.localizedDescription)"
                if let data = try? JSONSerialization.data(withJSONObject: [message]),
                   let arguments = String(data: data, encoding: .utf8) {
                    self?.webView.evaluateJavaScript("finishOpeningPreferences(\(arguments)[0], true)")
                }
            }
        }
    }

    deinit {
        stateTimer?.invalidate()
        NotificationCenter.default.removeObserver(self)
    }
}
