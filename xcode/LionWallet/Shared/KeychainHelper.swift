//
//  KeychainHelper.swift
//  Lion Wallet
//

import Security
import LocalAuthentication
import os.log

let keychainService = "app.lionwallet"

struct KeychainHelper {

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
