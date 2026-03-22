//
//  main.swift
//  Lion Wallet
//

import Cocoa

let isChromeHost = CommandLine.arguments.contains { $0.hasPrefix("chrome-extension://") }

if isChromeHost {
    NativeMessagingHost.run()
} else {
    _ = NSApplicationMain(CommandLine.argc, CommandLine.unsafeArgv)
}
