import { describe, expect, it } from 'vitest';
import { formatWinCount } from '../app/utils/format-count';

describe('formatWinCount', () => {
    it('shows small numbers exactly, grouped by thousands', () => {
        expect(formatWinCount(47)).toBe('47');
        expect(formatWinCount(12_345)).toBe('12,345');
    });

    it('switches to compact notation past the threshold', () => {
        expect(formatWinCount(2_400_000)).toBe('2.4M');
        expect(formatWinCount(1_000_000_000)).toBe('1B');
    });

    it('switches to scientific notation once compact units run out past a trillion', () => {
        // Compact notation has no named unit beyond trillion ('tn') — past
        // that it degrades into a huge digit string with 'tn' stuck on the
        // end (e.g. "22,164,388,045,943.7tn"), which is exactly the bug this
        // threshold exists to avoid.
        expect(formatWinCount(22_164_388_045_943.7)).toBe('2.22E13');
        expect(formatWinCount(2.2e25)).toBe('2.2E25');
    });

    it('treats non-finite or non-positive values as zero', () => {
        expect(formatWinCount(0)).toBe('0');
        expect(formatWinCount(-5)).toBe('0');
        expect(formatWinCount(Number.NaN)).toBe('0');
        expect(formatWinCount(Number.POSITIVE_INFINITY)).toBe('0');
    });
});
