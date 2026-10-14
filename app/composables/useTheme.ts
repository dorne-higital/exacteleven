import { computed } from 'vue';
import { trackEvent } from '../utils/analytics';
import { isAppBuild } from '../utils/platform';
import {
    APPEARANCE_STORAGE_KEY,
    DEFAULT_APPEARANCE,
    DEFAULT_KIT,
    KITS,
    KIT_STORAGE_KEY,
    applyThemeAttributes,
    effectiveKit,
    getKit,
    isAppearance,
    isKitId,
    kitIsUnlocked,
    resolveMode,
    themeColor,
} from '../utils/themes';
import type { Appearance, Kit, KitId } from '../utils/themes';
import { usePurchases } from './usePurchases';

// Appearance (system / light / dark — free, web and app) and the Kit Bag
// themes (app only, locked unless Kit Bag or Pro). The catalogue and the
// pure rules live in app/utils/themes.ts; this file keeps the choice in
// state + localStorage and puts it on <html>. app/plugins/theme.client.ts
// loads the saved choice and keeps <html> in step; app.vue reads
// browserTheme for the theme-color / color-scheme metas.

export interface KitOption extends Kit {
    /** True when the player needs Kit Bag or Pro to wear it. */
    locked: boolean;
}

function readItem(key: string): string | null {
    if (!import.meta.client) {
        return null;
    }

    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function writeItem(key: string, value: string): void {
    if (!import.meta.client) {
        return;
    }

    try {
        window.localStorage.setItem(key, value);
    } catch {
        // Private-mode/blocked storage: the choice just lasts this session.
    }
}

function readAppearance(): Appearance {
    const saved = readItem(APPEARANCE_STORAGE_KEY);

    return isAppearance(saved) ? saved : DEFAULT_APPEARANCE;
}

// The kit the player picked, unlocked or not (see effectiveKit for what's
// actually worn). The website has no kits, so it never reads one.
function readKitChoice(): KitId {
    if (!isAppBuild()) {
        return DEFAULT_KIT;
    }

    const saved = readItem(KIT_STORAGE_KEY);

    return isKitId(saved) ? saved : DEFAULT_KIT;
}

function systemPrefersDark(): boolean {
    if (!import.meta.client) {
        return false;
    }

    try {
        return window.matchMedia?.('(prefers-color-scheme: dark)').matches === true;
    } catch {
        return false;
    }
}

export function useTheme() {
    const appearance = useState<Appearance>('exact-xi-appearance', readAppearance);
    // Kept even when it's locked: a refunded or not-yet-restored kit falls
    // back to Bib & Board silently and comes back by itself on a restore.
    const savedKit = useState<KitId>('exact-xi-kit', readKitChoice);
    const systemDark = useState<boolean>('exact-xi-system-dark', systemPrefersDark);
    const { hasThemes } = usePurchases();

    // Kits are an app feature: the website only ever has Bib & Board.
    const kitsOffered = isAppBuild();

    /** The kit on screen right now. */
    const kit = computed<KitId>(() => effectiveKit(savedKit.value, hasThemes.value, kitsOffered));
    /** Light or dark on screen right now. */
    const mode = computed(() => resolveMode(appearance.value, kit.value, systemDark.value));

    const availableKits = computed<KitOption[]>(() => KITS
        .filter((option) => kitsOffered || option.id === DEFAULT_KIT)
        .map((option) => ({ ...option, locked: !kitIsUnlocked(option, hasThemes.value) })));

    // What the browser chrome should be tinted under a light and a dark
    // system setting, and the matching color-scheme meta. With Appearance on
    // 'system' and a light+dark kit these differ; otherwise they're the same.
    const browserTheme = computed(() => {
        const light = resolveMode(appearance.value, kit.value, false);
        const dark = resolveMode(appearance.value, kit.value, true);

        return {
            light: themeColor(appearance.value, kit.value, false),
            dark: themeColor(appearance.value, kit.value, true),
            colorScheme: light === dark ? light : 'light dark',
        };
    });

    /** Re-reads the saved choice (the plugin calls this once the page is live). */
    function load(): void {
        appearance.value = readAppearance();
        savedKit.value = readKitChoice();
        systemDark.value = systemPrefersDark();
    }

    /** Puts the current appearance + kit on <html>. */
    function apply(): void {
        if (!import.meta.client) {
            return;
        }

        applyThemeAttributes(document.documentElement, appearance.value, kit.value);
    }

    function setAppearance(next: Appearance, source = 'settings'): void {
        if (!isAppearance(next) || next === appearance.value) {
            return;
        }

        appearance.value = next;
        writeItem(APPEARANCE_STORAGE_KEY, next);
        apply();
        trackEvent('appearance_changed', { appearance: next, source });
    }

    /**
     * Wears a kit. False (nothing changes) for an unknown kit, on the
     * website, or for a locked one — the caller can offer the Kit Bag then.
     */
    function setKit(id: KitId, source = 'settings'): boolean {
        if (!isKitId(id)) {
            return false;
        }

        if (!kitsOffered || !kitIsUnlocked(getKit(id), hasThemes.value)) {
            trackEvent('kit_locked', { kit_id: id, source });

            return false;
        }

        if (savedKit.value === id) {
            return true;
        }

        savedKit.value = id;
        writeItem(KIT_STORAGE_KEY, id);
        apply();
        trackEvent('kit_changed', { kit_id: id, source });

        return true;
    }

    return {
        // State
        appearance,
        kit,
        mode,
        systemDark,
        availableKits,
        browserTheme,
        hasThemes,

        // Functions
        load,
        apply,
        setAppearance,
        setKit,
    };
}
