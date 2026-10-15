import { isBetterOutcome } from './scoring';
import type { Outcome } from './scoring';

// Pure merge rules for the iOS app's iCloud key-value backup
// (plugins/icloud-backup.client.ts ↔ ios/App/App/ICloudBackupPlugin.swift).
// Every value is the raw localStorage string, under the same key name in
// iCloud. Rule of thumb: a restore never takes anything away from this device
// — stats and the boost bank never go down, lists only grow.

export const BACKUP_KEYS = {
    stats: 'exact-xi-stats',
    seenAchievements: 'exact-xi-seen-achievements',
    achievementBest: 'exact-xi-achievement-best',
    boostBank: 'exact-xi-boost-bank',
    boostTransactions: 'exact-xi-boost-transactions',
    boostPrepaid: 'exact-xi-boost-prepaid',
    // The theme choice (useTheme / utils/themes.ts APPEARANCE_STORAGE_KEY and
    // KIT_STORAGE_KEY). A Kit Bag kit restored onto a device without the
    // unlock just shows Bib & Board until Restore Purchases brings it back.
    appearance: 'exact-xi-appearance',
    kit: 'exact-xi-kit',
} as const;

export type BackupKey = (typeof BACKUP_KEYS)[keyof typeof BACKUP_KEYS];

export const ALL_BACKUP_KEYS: BackupKey[] = Object.values(BACKUP_KEYS);

// Keys whose local value is pushed as it is, without folding the iCloud copy
// in first: the bank is a running total (spending must be able to lower it
// in the backup), and the theme and prepaid list belong to this device.
export const PUSH_AS_IS_KEYS: ReadonlySet<BackupKey> = new Set([BACKUP_KEYS.boostBank, BACKUP_KEYS.boostPrepaid, BACKUP_KEYS.appearance, BACKUP_KEYS.kit]);

type Json = Record<string, unknown>;

function parse(raw: string | null | undefined): unknown {
    if (raw === null || raw === undefined || raw === '') {
        return undefined;
    }
    try {
        return JSON.parse(raw);
    } catch {
        return undefined;
    }
}

function isRecord(value: unknown): value is Json {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function stringList(value: unknown): string[] | null {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : null;
}

// Live counters that can legitimately fall back to 0 (a broken streak, a
// broken run of exact wins): taking the bigger one would bring a lost streak
// back, so they come from the newer record instead. "best…" fields always
// take the max.
function isLiveCounter(key: string): boolean {
    return /(Streak|Run)$/.test(key) && !key.startsWith('best');
}

// The Daily's live, date-tied fields travel together from whichever record
// played a Daily most recently. dailyWinStreak is a live counter (the regex
// above already keeps it out of the max); bestDailyWinStreak, titleWinners
// and bestDailyScore are plain counts and take the max like everything else.
const DAILY_FIELDS = ['dailyStreak', 'dailyWinStreak', 'lastDailyResultDate', 'dailyResults', 'dailyScores'] as const;

function activity(stats: Json): number {
    return (isCount(stats.gamesPlayed) ? stats.gamesPlayed : 0) + (isCount(stats.dailyPlays) ? stats.dailyPlays : 0);
}

function maxCounts(a: unknown, b: unknown): Json | undefined {
    if (!isRecord(a) && !isRecord(b)) {
        return undefined;
    }
    const out: Json = { ...(isRecord(b) ? b : {}), ...(isRecord(a) ? a : {}) };
    for (const key of Object.keys(out)) {
        const left = isRecord(a) ? a[key] : undefined;
        const right = isRecord(b) ? b[key] : undefined;
        if (isCount(left) && isCount(right)) {
            out[key] = Math.max(left, right);
        }
    }
    return out;
}

// Stats can't be added up across devices without counting games twice, so the
// busier record is the base and every lifetime counter takes the larger of the
// two. Live streak/run counters come from the base, the Daily streak fields
// from whichever record played a Daily most recently, and the best result is
// the better of the two. Fields this build doesn't know (a newer build's
// stats) are kept. Returns the local value untouched when there's nothing to
// merge in.
export function mergeStatsJson(localRaw: string | null, cloudRaw: string | null | undefined): string | null {
    const local = parse(localRaw);
    const cloud = parse(cloudRaw);
    if (!isRecord(cloud)) {
        return localRaw;
    }
    if (!isRecord(local)) {
        return cloudRaw ?? localRaw;
    }

    const [base, other] = activity(cloud) > activity(local) ? [cloud, local] : [local, cloud];
    const merged: Json = { ...other, ...base };

    for (const key of Object.keys(merged)) {
        if (isLiveCounter(key)) {
            continue;
        }
        if (isCount(base[key]) && isCount(other[key])) {
            merged[key] = Math.max(base[key] as number, other[key] as number);
        }
    }

    for (const key of ['formationPlays', 'formationWins']) {
        const counts = maxCounts(base[key], other[key]);
        if (counts) {
            merged[key] = counts;
        }
    }

    const baseDate = typeof base.lastDailyResultDate === 'string' ? base.lastDailyResultDate : '';
    const otherDate = typeof other.lastDailyResultDate === 'string' ? other.lastDailyResultDate : '';
    if (otherDate > baseDate) {
        for (const key of DAILY_FIELDS) {
            if (key in other) {
                merged[key] = other[key];
            }
        }
    }

    const baseBest = isRecord(base.bestResult) ? base.bestResult : null;
    const otherBest = isRecord(other.bestResult) ? other.bestResult : null;
    if (otherBest && (!baseBest || isBetterOutcome(otherBest.outcome as Outcome, baseBest.outcome as Outcome))) {
        merged.bestResult = otherBest;
    }

    const result = JSON.stringify(merged);
    return result === localRaw ? localRaw : result;
}

// Lists that only ever grow (achievement ids already toasted, App Store
// transactions already credited): the union, local order first.
export function mergeListJson(localRaw: string | null, cloudRaw: string | null | undefined): string | null {
    const cloud = stringList(parse(cloudRaw));
    if (!cloud) {
        return localRaw;
    }
    const local = stringList(parse(localRaw));
    if (!local) {
        return JSON.stringify([...new Set(cloud)]);
    }
    const union = [...new Set([...local, ...cloud])];
    return union.length === local.length ? localRaw : JSON.stringify(union);
}

// { [achievementId]: best percent } — the per-id max.
export function mergeMaxMapJson(localRaw: string | null, cloudRaw: string | null | undefined): string | null {
    const cloud = parse(cloudRaw);
    if (!isRecord(cloud)) {
        return localRaw;
    }
    const local = parse(localRaw);
    const merged: Json = isRecord(local) ? { ...local } : {};
    let changed = !isRecord(local);
    for (const [id, value] of Object.entries(cloud)) {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
            continue;
        }
        const current = merged[id];
        if (typeof current !== 'number' || value > current) {
            merged[id] = value;
            changed = true;
        }
    }
    return changed ? JSON.stringify(merged) : localRaw;
}

// The bank is a running total that can't be merged, so a backup only ever
// raises it (a fresh install or a new phone getting its boosts back).
export function mergeBoostBank(localRaw: string | null, cloudRaw: string | null | undefined): string | null {
    const cloud = Number.parseInt(cloudRaw ?? '', 10);
    if (!Number.isFinite(cloud) || cloud < 0) {
        return localRaw;
    }
    const local = Number.parseInt(localRaw ?? '', 10);
    return Number.isFinite(local) && local >= cloud ? localRaw : String(cloud);
}

// Values that belong to one device (the theme choice, the boost-prepaid
// list): restored only onto a device that has none yet.
export function fillIfMissing(localRaw: string | null, cloudRaw: string | null | undefined): string | null {
    return localRaw === null && cloudRaw ? cloudRaw : localRaw;
}

// The merged value to store locally for a key, given this device's current
// value and the iCloud copy. Returns localRaw (the same string) when nothing
// needs to change.
export function mergeBackupValue(
    key: BackupKey,
    localRaw: string | null,
    cloudRaw: string | null | undefined,
    context: { freshPurchaseRecord: boolean } = { freshPurchaseRecord: false },
): string | null {
    switch (key) {
        case BACKUP_KEYS.stats:
            return mergeStatsJson(localRaw, cloudRaw);
        case BACKUP_KEYS.seenAchievements:
        case BACKUP_KEYS.boostTransactions:
            return mergeListJson(localRaw, cloudRaw);
        case BACKUP_KEYS.achievementBest:
            return mergeMaxMapJson(localRaw, cloudRaw);
        case BACKUP_KEYS.boostBank:
            return mergeBoostBank(localRaw, cloudRaw);
        case BACKUP_KEYS.boostPrepaid:
            // A prepaid entry settles a purchase the bank already holds. It's
            // only meaningful alongside the matching transaction list, so it
            // comes back only on a device with no purchase record at all.
            return context.freshPurchaseRecord ? fillIfMissing(localRaw, cloudRaw) : localRaw;
        case BACKUP_KEYS.appearance:
        case BACKUP_KEYS.kit:
            return fillIfMissing(localRaw, cloudRaw);
        default:
            return localRaw;
    }
}
