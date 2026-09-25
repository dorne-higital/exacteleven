import { ref } from 'vue';
import type { Ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStats } from '../app/composables/useStats';

// Same fakeUseState pattern as useGame.test.ts — see its comment for why
// this is enough (import.meta.client is falsy under plain vitest, so every
// localStorage/dataLayer-writing branch here is already a safe no-op).
const stateStore = new Map<string, Ref<unknown>>();

function fakeUseState<T>(key: string, init?: () => T): Ref<T> {
    if (!stateStore.has(key)) {
        stateStore.set(key, ref(init ? init() : undefined));
    }

    return stateStore.get(key) as Ref<T>;
}

beforeEach(() => {
    stateStore.clear();
    vi.stubGlobal('useState', fakeUseState);
});

// 2026-01-01 is a Thursday; dates below just need to be consecutive
// calendar days, not any particular weekday.
function dateFor(dayOffset: number): string {
    const d = new Date(Date.UTC(2026, 0, 1 + dayOffset));

    return d.toISOString().slice(0, 10);
}

describe('useStats — DailyStreakStrip recent-form log (recordDailyOutcome)', () => {
    it('logs each day\'s date and won/bust/lost status', () => {
        const { stats, recordDailyOutcome } = useStats();

        recordDailyOutcome('won', dateFor(0));
        recordDailyOutcome('bust', dateFor(1));
        recordDailyOutcome('lost', dateFor(2));

        expect(stats.value.dailyResults).toEqual([
            { date: dateFor(0), status: 'won' },
            { date: dateFor(1), status: 'bust' },
            { date: dateFor(2), status: 'lost' },
        ]);
    });

    it('does not double-log a same-day replay', () => {
        const { stats, recordDailyOutcome } = useStats();

        recordDailyOutcome('won', dateFor(0));
        recordDailyOutcome('bust', dateFor(0));

        expect(stats.value.dailyResults).toEqual([{ date: dateFor(0), status: 'won' }]);
    });

    it('caps the log at the rolling window, dropping the oldest entries first', () => {
        const { stats, recordDailyOutcome } = useStats();

        for (let day = 0; day < 15; day += 1) {
            recordDailyOutcome('won', dateFor(day));
        }

        expect(stats.value.dailyResults).toHaveLength(10);
        expect(stats.value.dailyResults[0]!.date).toBe(dateFor(5));
        expect(stats.value.dailyResults.at(-1)!.date).toBe(dateFor(14));
    });
});
