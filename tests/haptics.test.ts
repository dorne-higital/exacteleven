import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The Haptics on/off setting (Settings page). Capacitor is mocked so the
// "native shell" can be switched on; the website never fires anything.
const native = { value: true };
const impact = vi.fn(() => Promise.resolve());
const notification = vi.fn(() => Promise.resolve());

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.value } }));
vi.mock('@capacitor/haptics', () => ({
    Haptics: { impact, notification, selectionStart: vi.fn(() => Promise.resolve()), selectionEnd: vi.fn(() => Promise.resolve()) },
    ImpactStyle: { Light: 'LIGHT' },
    NotificationType: { Success: 'SUCCESS', Error: 'ERROR' },
}));

const { HAPTICS_STORAGE_KEY, haptics, hapticsEnabled, resetHapticsCache, setHapticsEnabled } = await import('../app/utils/haptics');

beforeEach(() => {
    window.localStorage.clear();
    resetHapticsCache();
    native.value = true;
    impact.mockClear();
    notification.mockClear();
});

afterEach(() => {
    resetHapticsCache();
});

describe('haptics setting', () => {
    it('is on by default', () => {
        expect(hapticsEnabled()).toBe(true);
        haptics.tap();
        expect(impact).toHaveBeenCalledTimes(1);
    });

    it('turning it off silences every call and is remembered', () => {
        setHapticsEnabled(false);
        expect(window.localStorage.getItem(HAPTICS_STORAGE_KEY)).toBe('0');

        haptics.tap();
        haptics.success();
        expect(impact).not.toHaveBeenCalled();
        expect(notification).not.toHaveBeenCalled();

        resetHapticsCache();
        expect(hapticsEnabled()).toBe(false);

        setHapticsEnabled(true);
        haptics.error();
        expect(notification).toHaveBeenCalledTimes(1);
    });

    it('does nothing on the website, whatever the setting', () => {
        native.value = false;
        haptics.tap();
        expect(impact).not.toHaveBeenCalled();
    });
});
