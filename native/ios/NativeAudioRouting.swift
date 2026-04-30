// ====================================================================
// NativeAudioRouting.swift
// ====================================================================
// COPIAZĂ acest fișier în: ios/App/App/NativeAudioRouting.swift
// DUPĂ ce rulezi: npx cap add ios
//
// Plus, în ios/App/App/AppDelegate.swift, în application(didFinishLaunching)
// adaugă: AVAudioSession permissions sunt deja gestionate prin Info.plist
// (vezi ghidul din BUILD_GUIDE.md)
// ====================================================================

import Foundation
import Capacitor
import AVFoundation

@objc(NativeAudioRoutingPlugin)
public class NativeAudioRoutingPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeAudioRoutingPlugin"
    public let jsName = "NativeAudioRouting"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startCallSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "endCallSession", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setSpeakerphone", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isSpeakerphoneOn", returnType: CAPPluginReturnPromise),
    ]

    private var speakerOn = false

    @objc func startCallSession(_ call: CAPPluginCall) {
        let session = AVAudioSession.sharedInstance()
        do {
            // Mode .voiceChat = optimizat pentru apel telefonic, forțează casca
            try session.setCategory(
                .playAndRecord,
                mode: .voiceChat,
                options: [.allowBluetooth, .allowBluetoothA2DP]
            )
            try session.setActive(true, options: .notifyOthersOnDeactivation)
            // Forțează casca (override speaker default)
            try session.overrideOutputAudioPort(.none)
            speakerOn = false
            call.resolve()
        } catch {
            call.reject("startCallSession failed: \(error.localizedDescription)")
        }
    }

    @objc func endCallSession(_ call: CAPPluginCall) {
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setActive(false, options: .notifyOthersOnDeactivation)
            speakerOn = false
            call.resolve()
        } catch {
            call.reject("endCallSession failed: \(error.localizedDescription)")
        }
    }

    @objc func setSpeakerphone(_ call: CAPPluginCall) {
        let enabled = call.getBool("enabled") ?? false
        let session = AVAudioSession.sharedInstance()
        do {
            try session.overrideOutputAudioPort(enabled ? .speaker : .none)
            speakerOn = enabled
            call.resolve()
        } catch {
            call.reject("setSpeakerphone failed: \(error.localizedDescription)")
        }
    }

    @objc func isSpeakerphoneOn(_ call: CAPPluginCall) {
        call.resolve(["enabled": speakerOn])
    }
}
