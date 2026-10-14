import { trackEvent } from '../utils/analytics';
import { isAppBuild } from '../utils/platform';

// Opens and closes the shop sheet (components/ShopSheet.vue), which app.vue
// mounts in the app build only. On the website openShop() does nothing and
// returns false — there is no shop and no route to one, so a stray call
// (or a future button) can never show purchases on the web.
//
// `source` says where the shop was opened from, for the view_shop event:
// 'reroll_button' | 'hint_button' | 'settings' | 'settings_kit' | 'stats'.
export function useShop() {
    const open = useState<boolean>('exact-xi-shop-open', () => false);
    const source = useState<string>('exact-xi-shop-source', () => '');

    function openShop(from: string): boolean {
        if (!isAppBuild()) {
            return false;
        }

        source.value = from;

        if (!open.value) {
            open.value = true;
            trackEvent('view_shop', { source: from });
        }

        return true;
    }

    function closeShop(): void {
        open.value = false;
    }

    return { open, source, openShop, closeShop };
}
