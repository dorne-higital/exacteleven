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
const isNative = (): boolean => Capacitor.isNativePlatform();

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
