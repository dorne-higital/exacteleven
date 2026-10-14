import { usePurchases } from '../composables/usePurchases';
import { isAppBuild } from '../utils/platform';

// The app build's purchases and boost bank: reads the cached Pro/Kit Bag
// state and the bank from storage, then (inside the native shell only)
// configures RevenueCat and loads the products. Does nothing on the website.
// usePurchases().init() never throws — a failure leaves a player-readable
// loadError for the shop to show with a retry.
export default defineNuxtPlugin(() => {
    if (!isAppBuild()) {
        return;
    }

    void usePurchases().init();
});
