import { watch } from 'vue';
import { useTheme } from '../composables/useTheme';
import { APPEARANCE_STORAGE_KEY, KIT_STORAGE_KEY } from '../utils/themes';

// Same name as plugins/icloud-backup.client.ts's ICLOUD_RESTORED_EVENT
// (not imported: that plugin file registers native code).
const ICLOUD_RESTORED_EVENT = 'exact-xi:icloud-restored';

// Puts the saved Appearance and Kit Bag theme on <html> and keeps it there.
// - App build (no SSR): runs before anything mounts, so the first screen
//   is already in the right theme (the native splash covers until then).
// - Website (SSR): an inline <head> script in app.vue has already set
//   data-theme before the first paint, so this waits until hydration is
//   done before reading storage into state. Reading it earlier would give
//   components a different state from the server's and a hydration
//   mismatch; touching <html> earlier would undo the head script.
// A kit whose unlock goes away (refund, not restored) drops back to Bib &
// Board on its own: `kit` is computed from hasThemes, and the watch below
// re-applies whenever it changes.
export default defineNuxtPlugin({
    name: 'exact-xi-theme',
    enforce: 'pre',
    setup(nuxtApp) {
        const theme = useTheme();

        // app:suspense:resolve fires again on every page change; once is enough.
        let started = false;
        const start = () => {
            if (started) {
                return;
            }

            started = true;
            theme.load();
            theme.apply();
            watch([theme.appearance, theme.kit], () => theme.apply());

            // iOS app: an iCloud restore (plugins/icloud-backup.client.ts)
            // can fill in the saved Appearance / kit on a new phone.
            window.addEventListener(ICLOUD_RESTORED_EVENT, (event) => {
                const keys = (event as CustomEvent<{ keys?: string[] }>).detail?.keys ?? [];

                if (keys.includes(APPEARANCE_STORAGE_KEY) || keys.includes(KIT_STORAGE_KEY)) {
                    theme.load();
                }
            });

            try {
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
                    theme.systemDark.value = event.matches;
                });
            } catch {
                // No matchMedia: theme-color just keeps the first reading.
            }
        };

        if (nuxtApp.isHydrating) {
            nuxtApp.hook('app:suspense:resolve', start);
        } else {
            start();
        }
    },
});
