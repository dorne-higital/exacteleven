import type { AchievementDef } from './achievements';
import type { GameStats } from './stats-types';
import { getAchievementProgress } from './achievements';

const SEEN_STORAGE_KEY = 'exact-xi-seen-achievements';

// Whether the key has EVER been written, not just whether it's empty —
// distinguishes "brand new player, nothing unlocked yet" (key absent, an
// empty array is the correct starting point) from "existing player adopting
// this feature, already owns badges" (key absent too, but backfilling is
// needed so those don't all fire as toasts at once). See backfillSeenIds().
export function hasSeenAchievementsRecord(): boolean {
    try {
        return window.localStorage.getItem(SEEN_STORAGE_KEY) !== null;
    } catch {
        return true;
    }
}

export function readSeenAchievementIds(): Set<string> {
    try {
        const raw = window.localStorage.getItem(SEEN_STORAGE_KEY);

        if (!raw) {
            return new Set();
        }

        const parsed: unknown = JSON.parse(raw);

        return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
    } catch {
        return new Set();
    }
}

export function writeSeenAchievementIds(ids: ReadonlySet<string>): void {
    try {
        window.localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify([...ids]));
    } catch {
        // Private-mode/blocked storage — notifications just won't dedupe across sessions this time.
    }
}

// One-time migration for a player who already had stats before this feature
// shipped: seeds the seen-set with everything they already own, silently,
// so recordOutcome's very next call doesn't treat their whole trophy
// cabinet as brand new.
export function backfillSeenAchievements(stats: GameStats): void {
    if (hasSeenAchievementsRecord()) {
        return;
    }

    const alreadyUnlocked = getAchievementProgress(stats).filter((progress) => progress.unlocked).map((progress) => progress.def.id);

    writeSeenAchievementIds(new Set(alreadyUnlocked));
}

// Pure so it's unit-testable without touching localStorage — the caller
// supplies the seen-set and both stats snapshots.
export function diffNewlyUnlocked(before: GameStats, after: GameStats, seenIds: ReadonlySet<string>): AchievementDef[] {
    const beforeUnlocked = new Set(getAchievementProgress(before).filter((progress) => progress.unlocked).map((progress) => progress.def.id));

    return getAchievementProgress(after)
        .filter((progress) => progress.unlocked && !beforeUnlocked.has(progress.def.id) && !seenIds.has(progress.def.id))
        .map((progress) => progress.def);
}
