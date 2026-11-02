import Foundation
import Security

// One preference shared by the containing app and native Safari extension.
// This keychain item contains only an analytics preference and a random ID.
enum Analytics {
    struct Preferences: Codable { var enabled: Bool; var id: String }
    private static let lock = NSLock()
    private static let group = "F93NU8DF46.local.reelsblocker.analytics"
    private static let allowedEvents: Set<String> = ["app_opened", "extension_started"]

    private static var query: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: "local.reelsblocker.analytics",
         kSecAttrAccount as String: "preferences",
         kSecAttrAccessGroup as String: group,
         kSecUseDataProtectionKeychain as String: true]
    }

    private static func save(_ preferences: Preferences) -> Bool {
        guard let data = try? JSONEncoder().encode(preferences) else { return false }
        let status = SecItemUpdate(query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecSuccess { return true }
        guard status == errSecItemNotFound else { return false }
        var item = query
        item[kSecValueData as String] = data
        item[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        return SecItemAdd(item as CFDictionary, nil) == errSecSuccess
    }

    private static func read() -> Preferences {
        var item = query
        item[kSecReturnData as String] = true
        item[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        let status = SecItemCopyMatching(item as CFDictionary, &result)
        if status == errSecSuccess, let data = result as? Data,
           let preferences = try? JSONDecoder().decode(Preferences.self, from: data) { return preferences }
        guard status == errSecItemNotFound else {
            NSLog("Analytics preference unavailable (%d); events disabled", status)
            return Preferences(enabled: false, id: "")
        }
        let initial = Preferences(enabled: true, id: UUID().uuidString)
        return save(initial) ? initial : Preferences(enabled: false, id: "")
    }

    static func preferences() -> Preferences {
        lock.lock(); defer { lock.unlock() }
        return read()
    }

    static func setEnabled(_ enabled: Bool) -> Bool {
        lock.lock(); defer { lock.unlock() }
        return save(Preferences(enabled: enabled, id: enabled ? UUID().uuidString : ""))
    }

    static func capture(_ event: String, completion: @escaping () -> Void = {}) {
        guard allowedEvents.contains(event) else { completion(); return }
        let preferences = preferences()
        guard preferences.enabled, !preferences.id.isEmpty,
              let configURL = Bundle.main.url(forResource: "analytics-config", withExtension: "json"),
              let configData = try? Data(contentsOf: configURL),
              let config = try? JSONSerialization.jsonObject(with: configData) as? [String: String],
              config["host"] == "https://eu.i.posthog.com", let token = config["token"], token.hasPrefix("phc_")
        else { completion(); return }
        let selected: [String: Any] = [ "app_version": "1.4.0",
            "language": Bundle.main.preferredLocalizations.first ?? "en",
            "$process_person_profile": false, "$geoip_disable": true, "$ip": "0.0.0.0"]
        let payload: [String: Any] = ["api_key": token, "event": event, "distinct_id": preferences.id, "properties": selected]
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let endpoint = URL(string: "https://eu.i.posthog.com/i/v0/e/") else { completion(); return }
        var request = URLRequest(url: endpoint, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 5)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = data
        URLSession.shared.dataTask(with: request) { _, _, _ in completion() }.resume()
    }
}
