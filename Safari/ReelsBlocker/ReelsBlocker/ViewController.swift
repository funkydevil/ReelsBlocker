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
    private var guideArrow: NSWindow?
    private var isArrowStep = false
    private var hasPositionedWindow = false

    private func hideGuideArrow() {
        guard let arrow = guideArrow else { return }
        arrow.parent?.removeChildWindow(arrow)
        arrow.close()
        guideArrow = nil
    }

    private func showGuideArrow() {
        guard let window = view.window else { return }
        let arrow: NSWindow
        if let existing = guideArrow {
            arrow = existing
        } else {
            arrow = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 84, height: 36),
                             styleMask: .borderless, backing: .buffered, defer: false)
            arrow.isOpaque = false
            arrow.backgroundColor = .clear
            arrow.hasShadow = false
            arrow.ignoresMouseEvents = true
            arrow.isReleasedWhenClosed = false
            arrow.level = .floating
            arrow.collectionBehavior = [.moveToActiveSpace, .fullScreenAuxiliary]
            arrow.contentView = GuideArrowView(frame: NSRect(x: 0, y: 0, width: 84, height: 36))
            guideArrow = arrow
        }
        arrow.setFrameOrigin(NSPoint(x: window.frame.minX - 80, y: window.frame.maxY - 90))
        if arrow.parent !== window { window.addChildWindow(arrow, ordered: .above) }
        arrow.orderFront(nil)
    }

    override func viewDidAppear() {
        super.viewDidAppear()
        if !hasPositionedWindow {
            positionSetupWindow()
            hasPositionedWindow = true
        }
        if isArrowStep { showGuideArrow() }
    }

    override func viewWillDisappear() {
        hideGuideArrow()
        super.viewWillDisappear()
    }

    private func positionSetupWindow() {
        guard let window = view.window, let screen = window.screen ?? NSScreen.main else { return }
        let area = screen.visibleFrame.insetBy(dx: 16, dy: 16)
        var frame = NSRect(origin: .zero, size: NSSize(width: min(300, area.width), height: min(300, area.height)))
        frame.origin = NSPoint(x: area.maxX - frame.width, y: area.midY - frame.height / 2)
        window.setFrame(frame, display: true)
        window.level = .floating
        window.hidesOnDeactivate = false
        window.collectionBehavior = [.moveToActiveSpace, .fullScreenAuxiliary]
    }

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
        case "setup-step-1", "setup-step-2":
            isArrowStep = false
            hideGuideArrow()
            positionSetupWindow()
            return
        case "setup-step-3":
            isArrowStep = true
            // This arrow is an illustration until the user aligns the guide.
            // Do not guess the position of a control in another application.
            showGuideArrow()
            return
        case "setup-step-4":
            isArrowStep = false
            hideGuideArrow()
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
                userInfo: [NSLocalizedDescriptionKey: "Safari не найден на этом Mac."]))
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
                ? "Safari не нашёл расширение. Закрой старые копии приложения и попробуй снова."
                : "Не удалось открыть настройки. Попробуй ещё раз."
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
                let message = "Не удалось открыть сайт в Safari. Попробуй ещё раз."
                if let data = try? JSONSerialization.data(withJSONObject: [message]),
                   let arguments = String(data: data, encoding: .utf8) {
                    self?.webView.evaluateJavaScript("showWebsiteError(\(arguments)[0])")
                }
            }
        }
    }

    deinit {
        hideGuideArrow()
        stateTimer?.invalidate()
        NotificationCenter.default.removeObserver(self)
    }
}

private final class GuideArrowView: NSView {
    override var isOpaque: Bool { false }

    override func draw(_ dirtyRect: NSRect) {
        let arrow = NSBezierPath()
        arrow.move(to: NSPoint(x: 78, y: 18))
        arrow.line(to: NSPoint(x: 8, y: 18))
        arrow.move(to: NSPoint(x: 20, y: 29))
        arrow.line(to: NSPoint(x: 8, y: 18))
        arrow.line(to: NSPoint(x: 20, y: 7))
        arrow.lineCapStyle = .round
        arrow.lineJoinStyle = .round
        NSColor.windowBackgroundColor.setStroke()
        arrow.lineWidth = 7
        arrow.stroke()
        NSColor.systemGreen.setStroke()
        arrow.lineWidth = 3
        arrow.stroke()
    }
}
