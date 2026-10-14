import { registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { ALL_BACKUP_KEYS, BACKUP_KEYS, PUSH_AS_IS_KEYS, mergeBackupValue } from '../utils/icloud-backup';
import type { BackupKey } from '../utils/icloud-backup';
import { isNativeApp } from '../utils/platform';

// iOS app only: backs up stats, the achievement caches, the boost bank (and
// its App Store transaction lists) and the theme choice to iCloud key-value
// storage (ios/App/App/ICloudBackupPlugin.swift), so a deleted app or a new
// iPhone gets them back. Ported from Footballdle's icloud-backup.client.ts.
// Until the app has the iCloud key-value capability the native store never
// syncs, so all of this quietly does nothing; on the website it never runs.
//
// The merge rules live in utils/icloud-backup.ts. In short: a restore never
// lowers stats or the bank, and lists only grow. The bank is only written to
// iCloud when it changes here after launch, never on launch itself, so a fresh
// install's welcome boosts can't overwrite a bigger bank still downloading.
//
// After a restore changes anything, stats are reloaded and the bank is handed
// to usePurchases().restoreBoostBank() here, and the window event
// 'exact-xi:icloud-restored' ({ detail: { keys } }) tells anything else that
// keeps a backed-up key in memory (the theme choice) to re-read it.
interface ICloudBackupPlugin {
    get(options: { key: string }): Promise<{ value?: string }>;
    set(options: { key: string; value: string }): Promise<void>;
    addListener(event: 'changed', fn: (data: { initial?: boolean }) => void): Promise<unknown>;
}

export const ICLOUD_RESTORED_EVENT = 'exact-xi:icloud-restored';

// How often local changes are looked for. Comparing a handful of short
// localStorage strings is cheap, and it keeps this file from needing a hook
// into every place that writes one of these keys.
const CHECK_INTERVAL_MS = 5000;

function readLocal(key: string): string | null {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function writeLocal(key: string, value: string): boolean {
    try {
        window.localStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

export default defineNuxtPlugin(() => {
    if (!isNativeApp()) {
        return;
    }

    // Registered only inside the native shell. The proxy is only ever used for
    // method calls, never returned or awaited (Capacitor proxies are thenables).
    const ICloudBackup = registerPlugin<ICloudBackupPlugin>('ICloudBackup');
    const { loadStats } = useStats();
    const { restoreBoostBank } = usePurchases();

    // Writes a merged value and brings the in-memory copy up to date straight
    // away (before the next await), so a game finishing mid-sync can't save
    // over it from stale state.
    function applyLocal(key: BackupKey, value: string): boolean {
        if (!writeLocal(key, value)) {
            return false;
        }
        if (key === BACKUP_KEYS.stats) {
            loadStats();
        } else if (key === BACKUP_KEYS.boostBank) {
            restoreBoostBank(Number.parseInt(value, 10));
        }
        return true;
    }

    function announce(keys: BackupKey[]): void {
        if (keys.length) {
            window.dispatchEvent(new CustomEvent(ICLOUD_RESTORED_EVENT, { detail: { keys } }));
        }
    }

    // The value each key had the last time it was pushed or pulled, so only a
    // real local change is ever written back to iCloud.
    const synced = new Map<BackupKey, string | null>();
    let ready = false;
    let busy: Promise<void> = Promise.resolve();

    async function readCloud(key: BackupKey): Promise<string | undefined> {
        try {
            return (await ICloudBackup.get({ key })).value;
        } catch {
            return undefined;
        }
    }

    // Folds the iCloud copy of every key into this device and applies it.
    // What counts as already synced afterwards decides what push() sends:
    // - the bank, prepaid list and theme choice: their value at launch, so they only
    //   go up once they change here (never on launch itself);
    // - stats and lists: the iCloud copy, so whatever this device adds to it
    //   goes up at the next check. With no iCloud copy yet (a fresh install
    //   whose backup may still be downloading) nothing is sent until the
    //   player changes something.
    async function pull(initial = false): Promise<void> {
        const freshPurchaseRecord = readLocal(BACKUP_KEYS.boostTransactions) === null && readLocal(BACKUP_KEYS.boostPrepaid) === null;
        const changed: BackupKey[] = [];

        for (const key of ALL_BACKUP_KEYS) {
            const cloud = await readCloud(key);
            const local = readLocal(key);
            const next = mergeBackupValue(key, local, cloud, { freshPurchaseRecord });
            if (next !== null && next !== local && applyLocal(key, next)) {
                changed.push(key);
            }
            if (PUSH_AS_IS_KEYS.has(key)) {
                if (initial) {
                    synced.set(key, readLocal(key));
                }
            } else if (cloud !== undefined) {
                synced.set(key, cloud);
            } else if (initial) {
                synced.set(key, readLocal(key));
            }
        }

        announce(changed);
    }

    // Writes every key that changed locally since it was last synced. Lists and
    // stats fold the iCloud copy in first, so another device's progress isn't
    // overwritten; the bank, prepaid list and theme choice go up as they are.
    async function push(): Promise<void> {
        const restored: BackupKey[] = [];

        for (const key of ALL_BACKUP_KEYS) {
            let local = readLocal(key);
            if (local === null || local === synced.get(key)) {
                continue;
            }
            if (!PUSH_AS_IS_KEYS.has(key)) {
                const next = mergeBackupValue(key, local, await readCloud(key));
                if (next !== null && next !== local && applyLocal(key, next)) {
                    restored.push(key);
                    local = next;
                }
            }
            try {
                await ICloudBackup.set({ key, value: local });
                synced.set(key, local);
            } catch {
                // Try again at the next check.
            }
        }

        announce(restored);
    }

    // One sync at a time, so a pull and a push never interleave their reads
    // and writes of the same key.
    function queue(task: () => Promise<void>): void {
        busy = busy.then(task).catch(() => {});
    }

    queue(async () => {
        await pull(true);
        ready = true;
    });

    // At most one push waiting in the queue at a time.
    let pushQueued = false;
    function schedulePush(): void {
        if (!ready || pushQueued) {
            return;
        }
        pushQueued = true;
        queue(() => {
            pushQueued = false;
            return push();
        });
    }

    setInterval(schedulePush, CHECK_INTERVAL_MS);

    // Going to the background is the last reliable moment before iOS may
    // suspend or kill the app, so anything waiting goes up straight away.
    App.addListener('pause', schedulePush).catch(() => {});

    // Another device (or the first download on a fresh install) changed the
    // backup.
    ICloudBackup.addListener('changed', () => {
        queue(() => pull());
    }).catch(() => {});
});
