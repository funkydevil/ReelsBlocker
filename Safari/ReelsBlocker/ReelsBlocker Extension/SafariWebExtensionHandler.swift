import SafariServices

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem
        let payload = request?.userInfo?[SFExtensionMessageKey] as? [String: Any] ?? [:]
        func respond(_ values: [String: Any]) {
            let response = NSExtensionItem()
            response.userInfo = [SFExtensionMessageKey: values]
            context.completeRequest(returningItems: [response], completionHandler: nil)
        }
        switch payload["action"] as? String {
        case "analytics_get":
            respond(["ok": true, "enabled": Analytics.preferences().enabled])
        case "analytics_set":
            guard let enabled = payload["enabled"] as? Bool else { respond(["ok": false]); return }
            let saved = Analytics.setEnabled(enabled)
            respond(["ok": saved, "enabled": Analytics.preferences().enabled])
        case "analytics_capture":
            guard let event = payload["event"] as? String else { respond(["ok": false]); return }
            Analytics.capture(event, properties: payload["properties"] as? [String: Any] ?? [:], source: "popup") {
                respond(["ok": true])
            }
        default: respond(["ok": false])
        }
    }
}
