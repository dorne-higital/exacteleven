import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

// Taptic feedback in the iOS app; silently does nothing on the website (and on
// Android, where these calls still resolve harmlessly). Fire-and-forget: every
// call returns void and swallows its own rejection, so callers never await a
// Capacitor plugin proxy (those look like thenables and can hang a promise
// chain — see the Footballdle handbook rule).
//
// Intended call sites:
// - haptics.tap()     a player is picked into a slot (useGame pickPlayer)
// - haptics.select()  a slot draw / reroll lands (useGame draw + reroll)
// - haptics.success() the XI is completed on target, or a challenge is won
// - haptics.error()   a bust / missed target at full time
//
// The Settings page's Haptics switch turns all of them off: stored as '0'
// under HAPTICS_STORAGE_KEY (absent or anything else = on, the default).
export const HAPTICS_STORAGE_KEY = 'exact-xi-haptics';

// Read once, then kept in step by setHapticsEnabled — every tap would
// otherwise hit localStorage.
let enabledCache: boolean | null = null;

export function hapticsEnabled(): boolean {
    if (enabledCache === null) {
        try {
            enabledCache = window.localStorage.getItem(HAPTICS_STORAGE_KEY) !== '0';
        } catch {
            enabledCache = true;
        }
    }

    return enabledCache;
}

export function setHapticsEnabled(enabled: boolean): void {
    enabledCache = enabled;

    try {
        window.localStorage.setItem(HAPTICS_STORAGE_KEY, enabled ? '1' : '0');
    } catch {
        // Storage blocked: the choice lasts this session.
    }
}

// Tests only: forget the cached setting so the next read goes to storage.
export function resetHapticsCache(): void {
    enabledCache = null;
}

const isNative = (): boolean => Capacitor.isNativePlatform() && hapticsEnabled();

export const haptics = {
    tap(): void {
        if (isNative()) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    },
    select(): void {
        if (isNative()) Haptics.selectionStart().then(() => Haptics.selectionEnd()).catch(() => {});
    },
    success(): void {
        if (isNative()) Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    },
    error(): void {
        if (isNative()) Haptics.notification({ type: NotificationType.Error }).catch(() => {});
    },
};
