//
//  SafariWebExtensionHandler.swift
//  Lion Wallet Extension
//
//  Created by Oleksandr Shevchuk on 20.03.2026.
//

import SafariServices
import Security
import LocalAuthentication
import os.log

private let keychainService = "dev.wallet.SafariEVMWallet"

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        let request = context.inputItems.first as? NSExtensionItem

        let message: Any?
        if #available(iOS 15.0, macOS 11.0, *) {
            message = request?.userInfo?[SFExtensionMessageKey]
        } else {
            message = request?.userInfo?["message"]
        }

        guard let dict = message as? [String: Any],
              let action = dict["action"] as? String else {
            respond(context: context, payload: ["ok": false, "error": "Invalid message"])
            return
        }

        os_log(.default, "Native message action: %@", action)

        switch action {
        case "keychain_status":
            let (available, probeError) = KeychainHelper.probe()
            var statusPayload: [String: Any] = ["ok": available]
            if let probeError = probeError {
                statusPayload["error"] = probeError
            }
            respond(context: context, payload: statusPayload)

        case "keychain_store":
            guard let key = dict["key"] as? String,
                  let value = dict["value"] as? String else {
                respond(context: context, payload: ["ok": false, "error": "Missing key or value"])
                return
            }
            let (success, storeError) = KeychainHelper.store(key: key, value: value)
            var payload: [String: Any] = ["ok": success]
            if let storeError = storeError {
                payload["error"] = storeError
            }
            respond(context: context, payload: payload)

        case "keychain_retrieve":
            guard let key = dict["key"] as? String else {
                respond(context: context, payload: ["ok": false, "error": "Missing key"])
                return
            }
            let laContext = LAContext()
            laContext.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "Authenticate to access wallet") { success, authError in
                if !success {
                    let msg = authError?.localizedDescription ?? "Authentication failed"
                    os_log(.error, "LAContext auth failed: %{public}@", msg)
                    self.respond(context: context, payload: ["ok": false, "error": msg])
                    return
                }
                if let value = KeychainHelper.retrieve(key: key, context: laContext) {
                    self.respond(context: context, payload: ["ok": true, "value": value])
                } else {
                    self.respond(context: context, payload: ["ok": false, "error": "Item not found"])
                }
            }

        case "keychain_delete":
            guard let key = dict["key"] as? String else {
                respond(context: context, payload: ["ok": false, "error": "Missing key"])
                return
            }
            let success = KeychainHelper.delete(key: key)
            respond(context: context, payload: ["ok": success])

        case "keychain_has":
            guard let key = dict["key"] as? String else {
                respond(context: context, payload: ["ok": false, "error": "Missing key"])
                return
            }
            let exists = KeychainHelper.has(key: key)
            respond(context: context, payload: ["ok": true, "exists": exists])

        default:
            respond(context: context, payload: ["ok": false, "error": "Unknown action: \(action)"])
        }
    }

    private func respond(context: NSExtensionContext, payload: [String: Any]) {
        let response = NSExtensionItem()
        if #available(iOS 15.0, macOS 11.0, *) {
            response.userInfo = [SFExtensionMessageKey: payload]
        } else {
            response.userInfo = ["message": payload]
        }
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}

private struct KeychainHelper {

    static func probe() -> (Bool, String?) {
        let testKey = "__keychain_probe__"
        guard let data = "probe".data(using: .utf8) else {
            return (false, "UTF-8 encoding failed in probe")
        }

        var acError: Unmanaged<CFError>?
        guard let access = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            .userPresence,
            &acError
        ) else {
            let msg = "probe: SecAccessControlCreateWithFlags failed: \(acError.debugDescription)"
            os_log(.error, "%{public}@", msg)
            return (false, msg)
        }

        delete(key: testKey)

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: testKey,
            kSecValueData as String: data,
            kSecAttrAccessControl as String: access,
        ]

        let addStatus = SecItemAdd(query as CFDictionary, nil)
        delete(key: testKey)

        if addStatus == errSecSuccess {
            return (true, nil)
        }
        let msg = "probe: SecItemAdd failed with OSStatus \(addStatus)"
        os_log(.error, "%{public}@", msg)
        return (false, msg)
    }

    static func store(key: String, value: String) -> (Bool, String?) {
        guard let data = value.data(using: .utf8) else { return (false, "UTF-8 encoding failed") }

        delete(key: key)

        var error: Unmanaged<CFError>?
        guard let access = SecAccessControlCreateWithFlags(
            nil,
            kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            .userPresence,
            &error
        ) else {
            let msg = "Access control creation failed: \(error.debugDescription)"
            os_log(.error, "Failed to create access control: %@", error.debugDescription)
            return (false, msg)
        }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessControl as String: access,
        ]

        let status = SecItemAdd(query as CFDictionary, nil)
        if status != errSecSuccess {
            os_log(.error, "Keychain store failed: %d", status)
            return (false, "SecItemAdd failed with status \(status)")
        }
        return (true, nil)
    }

    static func retrieve(key: String, context: LAContext) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecUseAuthenticationContext as String: context,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess, let data = result as? Data else {
            if status != errSecItemNotFound {
                os_log(.error, "Keychain retrieve failed: %d", status)
            }
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    @discardableResult
    static func delete(key: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: key,
        ]
        let status = SecItemDelete(query as CFDictionary)
        return status == errSecSuccess || status == errSecItemNotFound
    }

    static func has(key: String) -> Bool {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: key,
            kSecUseAuthenticationUI as String: kSecUseAuthenticationUISkip,
        ]
        let status = SecItemCopyMatching(query as CFDictionary, nil)
        return status == errSecSuccess || status == errSecInteractionNotAllowed
    }
}
