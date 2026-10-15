import { beforeEach, describe, expect, it } from 'vitest';
import { getInstallId, INSTALL_ID_STORAGE_KEY, isValidInstallId, resetInstallIdForTests, restoreInstallId } from '../app/utils/install-id';

beforeEach(() => {
    window.localStorage.clear();
    resetInstallIdForTests();
});

describe('install id', () => {
    it('mints a valid id once and keeps returning it', () => {
        const id = getInstallId();

        expect(isValidInstallId(id)).toBe(true);
        expect(getInstallId()).toBe(id);
        expect(window.localStorage.getItem(INSTALL_ID_STORAGE_KEY)).toBe(id);
    });

    it('reuses a stored id and replaces a malformed one', async () => {
        window.localStorage.setItem(INSTALL_ID_STORAGE_KEY, 'abcdef12-3456');
        expect(getInstallId()).toBe('abcdef12-3456');

        resetInstallIdForTests();
        window.localStorage.setItem(INSTALL_ID_STORAGE_KEY, 'bad id!');
        const fresh = getInstallId();

        expect(fresh).not.toBe('bad id!');
        expect(isValidInstallId(fresh)).toBe(true);
        // On the web, restoring is just reading it.
        expect(await restoreInstallId()).toBe(fresh);
    });
});
