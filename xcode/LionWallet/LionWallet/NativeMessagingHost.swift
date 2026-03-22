//
//  NativeMessagingHost.swift
//  Lion Wallet
//
//  Chrome native messaging host — stdin/stdout JSON protocol.
//  Launched by Chrome when the extension calls sendNativeMessage().
//  Uses the same KeychainHelper as the Safari extension handler.
//

import Foundation
import LocalAuthentication
import os.log

struct NativeMessagingHost {

    static func run() {
        guard let message = readMessage() else {
            writeMessage(["ok": false, "error": "Failed to read message from stdin"])
            return
        }

        guard let action = message["action"] as? String else {
            writeMessage(["ok": false, "error": "Missing action field"])
            return
        }

        os_log(.default, "Chrome native message action: %@", action)

        switch action {
        case "keychain_status":
            let (available, probeError) = KeychainHelper.probe()
            var payload: [String: Any] = ["ok": available]
            if let probeError = probeError {
                payload["error"] = probeError
            }
            writeMessage(payload)

        case "keychain_store":
            guard let key = message["key"] as? String,
                  let value = message["value"] as? String else {
                writeMessage(["ok": false, "error": "Missing key or value"])
                return
            }
            let (success, storeError) = KeychainHelper.store(key: key, value: value)
            var payload: [String: Any] = ["ok": success]
            if let storeError = storeError {
                payload["error"] = storeError
            }
            writeMessage(payload)

        case "keychain_retrieve":
            guard let key = message["key"] as? String else {
                writeMessage(["ok": false, "error": "Missing key"])
                return
            }
            let reason = message["reason"] as? String ?? "Authenticate to access wallet"
            let semaphore = DispatchSemaphore(value: 0)
            var response: [String: Any] = ["ok": false, "error": "Authentication timed out"]

            let laContext = LAContext()
            laContext.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { success, authError in
                if !success {
                    let msg = authError?.localizedDescription ?? "Authentication failed"
                    os_log(.error, "LAContext auth failed: %{public}@", msg)
                    response = ["ok": false, "error": msg]
                } else if let value = KeychainHelper.retrieve(key: key, context: laContext) {
                    response = ["ok": true, "value": value]
                } else {
                    response = ["ok": false, "error": "Item not found"]
                }
                semaphore.signal()
            }
            semaphore.wait()
            writeMessage(response)

        case "keychain_delete":
            guard let key = message["key"] as? String else {
                writeMessage(["ok": false, "error": "Missing key"])
                return
            }
            let success = KeychainHelper.delete(key: key)
            writeMessage(["ok": success])

        case "keychain_has":
            guard let key = message["key"] as? String else {
                writeMessage(["ok": false, "error": "Missing key"])
                return
            }
            let exists = KeychainHelper.has(key: key)
            writeMessage(["ok": true, "exists": exists])

        default:
            writeMessage(["ok": false, "error": "Unknown action: \(action)"])
        }
    }

    // MARK: - Chrome native messaging protocol (length-prefixed JSON over stdio)

    private static func readMessage() -> [String: Any]? {
        let stdin = FileHandle.standardInput

        let lengthData = stdin.readData(ofLength: 4)
        guard lengthData.count == 4 else { return nil }

        let length = lengthData.withUnsafeBytes { $0.load(as: UInt32.self) }
        let messageLength = UInt32(littleEndian: length)
        guard messageLength > 0, messageLength < 1_048_576 else { return nil }

        let messageData = stdin.readData(ofLength: Int(messageLength))
        guard messageData.count == Int(messageLength) else { return nil }

        guard let json = try? JSONSerialization.jsonObject(with: messageData),
              let dict = json as? [String: Any] else { return nil }

        return dict
    }

    private static func writeMessage(_ payload: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: payload) else { return }

        var length = UInt32(data.count).littleEndian
        let lengthData = Data(bytes: &length, count: 4)

        let stdout = FileHandle.standardOutput
        stdout.write(lengthData)
        stdout.write(data)
    }
}
