import Capacitor
import Foundation

// Backs up stats, achievement caches, the boost bank and theme to iCloud key-value storage, so they survive
// deleting the app or moving to a new iPhone. Without the iCloud capability (entitlement
// com.apple.developer.ubiquity-kvstore-identifier) the store simply never syncs, so this
// is safe to ship before iCloud is switched on. JS side: app/plugins/icloud-backup.client.ts.
@objc(ICloudBackupPlugin)
public class ICloudBackupPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ICloudBackupPlugin"
    public let jsName = "ICloudBackup"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise)
    ]

    private let store = NSUbiquitousKeyValueStore.default

    override public func load() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(changedExternally),
            name: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
            object: store
        )
        store.synchronize()
    }

    @objc func changedExternally(_ notification: Notification) {
        let reason = notification.userInfo?[NSUbiquitousKeyValueStoreChangeReasonKey] as? Int
        // First download of this iCloud account's data on this device (fresh install)
        let initial = reason == NSUbiquitousKeyValueStoreInitialSyncChange
            || reason == NSUbiquitousKeyValueStoreAccountChange
        notifyListeners("changed", data: ["initial": initial])
    }

    @objc func get(_ call: CAPPluginCall) {
        guard let key = call.getString("key") else {
            call.reject("key is required")
            return
        }
        if let value = store.string(forKey: key) {
            call.resolve(["value": value])
        } else {
            call.resolve([:])
        }
    }

    @objc func set(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), let value = call.getString("value") else {
            call.reject("key and value are required")
            return
        }
        store.set(value, forKey: key)
        store.synchronize()
        call.resolve()
    }
}
