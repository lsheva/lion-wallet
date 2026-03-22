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
            let reason = dict["reason"] as? String ?? "Authenticate to access wallet"
            let laContext = LAContext()
            laContext.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, authError in
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
