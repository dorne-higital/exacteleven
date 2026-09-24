import { describe, expect, it } from 'vitest';
import { buildChallengeQuery, challengeKeyFromQuery } from '../app/utils/challenge-config';

describe('buildChallengeQuery', () => {
    it('always includes the formation and mode', () => {
        expect(buildChallengeQuery({ formationCode: '442', mode: 'exact', presetSlotIds: [] })).toEqual({
            f: '442',
            mode: 'exact',
        });
    });

    it('includes value only when set', () => {
        expect(buildChallengeQuery({ formationCode: '442', mode: 'over', value: 400, presetSlotIds: [] })).toEqual({
            f: '442',
            mode: 'over',
            value: '400',
        });
    });

    it('includes preset only when there are slots', () => {
        expect(buildChallengeQuery({ formationCode: '442', mode: 'exact', presetSlotIds: ['def-1', 'mid-2'] })).toEqual({
            f: '442',
            mode: 'exact',
            preset: 'def-1,mid-2',
        });
    });
});

describe('challengeKeyFromQuery', () => {
    it('is stable regardless of key insertion order', () => {
        const a = challengeKeyFromQuery({ f: '442', mode: 'over', value: '400' });
        const b = challengeKeyFromQuery({ mode: 'over', value: '400', f: '442' });

        expect(a).toBe(b);
    });

    it('differs when any value differs', () => {
        const a = challengeKeyFromQuery({ f: '442', mode: 'over' });
        const b = challengeKeyFromQuery({ f: '433', mode: 'over' });

        expect(a).not.toBe(b);
    });
});
