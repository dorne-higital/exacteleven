import { createGameId } from './game-id';
import { isNativeApp } from './platform';

// An anonymous random id per install, sent with the Daily's /start and
// /submit so the server can rank only the first run per install per day
// (DAILY2_SPEC §3.3, §3.6). Same format as a game id (/^[\w-]{8,64}$/). It
// is per install by design: never backed up to iCloud, never tied to an
// account or a name.
//
// In the app, iOS can clear a webview's localStorage under storage pressure,
// so the id is mirrored to Capacitor Preferences (native UserDefaults) and
// restored from there on launch (restoreInstallId, called by useDaily
// before its first ranked call).
export const INSTALL_ID_STORAGE_KEY = 'exact-xi-install-id';

const INSTALL_ID_PATTERN = /^[\w-]{8,64}$/;

// Kept for the session, so storage that throws (private mode) still gives
// one stable id for as long as the page is open.
let memoryId: string | null = null;

export function isValidInstallId(value: unknown): value is string {
    return typeof value === 'string' && INSTALL_ID_PATTERN.test(value);
}

function readStored(): string | null {
    try {
        const stored = window.localStorage.getItem(INSTALL_ID_STORAGE_KEY);

        return isValidInstallId(stored) ? stored : null;
    } catch {
        return null;
    }
}

function writeStored(id: string): void {
    try {
        window.localStorage.setItem(INSTALL_ID_STORAGE_KEY, id);
    } catch {
        // Blocked storage: memoryId keeps it stable for this session.
    }
}

async function mirrorToPreferences(id: string): Promise<void> {
    if (!isNativeApp()) {
        return;
    }

    try {
        const { Preferences } = await import('@capacitor/preferences');

        await Preferences.set({ key: INSTALL_ID_STORAGE_KEY, value: id });
    } catch {
        // The localStorage copy still works; the mirror is a safety net.
    }
}

export function getInstallId(): string {
    const stored = readStored();

    if (stored) {
        memoryId = stored;

        return stored;
    }

    if (memoryId) {
        writeStored(memoryId);

        return memoryId;
    }

    const id = createGameId();

    memoryId = id;
    writeStored(id);
    void mirrorToPreferences(id);

    return id;
}

// App only: if localStorage lost the id but the native mirror still has it,
// put it back (so a cleared webview doesn't look like a new install and get
// a second ranked run). On the web this is just getInstallId().
export async function restoreInstallId(): Promise<string> {
    if (!isNativeApp()) {
        return getInstallId();
    }

    const stored = readStored();

    try {
        const { Preferences } = await import('@capacitor/preferences');
        const { value } = await Preferences.get({ key: INSTALL_ID_STORAGE_KEY });

        if (isValidInstallId(value)) {
            if (value !== stored) {
                writeStored(value);
            }

            memoryId = value;

            return value;
        }
    } catch {
        // Fall through to the localStorage id.
    }

    const id = getInstallId();

    void mirrorToPreferences(id);

    return id;
}

// Tests only.
export function resetInstallIdForTests(): void {
    memoryId = null;
}
