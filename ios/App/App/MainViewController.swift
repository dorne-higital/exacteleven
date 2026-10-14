import Capacitor

// Registers the app's own (non-npm) Capacitor plugins.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(GameCenterPlugin())
        bridge?.registerPluginInstance(ICloudBackupPlugin())
    }
}
