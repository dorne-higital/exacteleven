import { describe, expect, it } from 'vitest';
import { classifyReveal, pickFlavorLine } from '../app/utils/reveal-flavor';

describe('classifyReveal', () => {
    it('is always "bust" regardless of margin', () => {
        expect(classifyReveal('bust', 50)).toBe('bust');
        expect(classifyReveal('bust', null)).toBe('bust');
    });

    it('is always "win" regardless of margin', () => {
        expect(classifyReveal('won', 50)).toBe('win');
        expect(classifyReveal('won', null)).toBe('win');
    });

    it('is "close" when still playing and within the threshold of the ceiling', () => {
        expect(classifyReveal('playing', 0)).toBe('close');
        expect(classifyReveal('playing', 15)).toBe('close');
    });

    it('is null when still playing but far from the ceiling', () => {
        expect(classifyReveal('playing', 16)).toBeNull();
        expect(classifyReveal('playing', 200)).toBeNull();
    });

    it('is null when there is no ceiling to be close to (e.g. the "over" objective)', () => {
        expect(classifyReveal('playing', null)).toBeNull();
    });

    it('is null for a negative margin (already past the ceiling but not flagged as bust by the caller)', () => {
        expect(classifyReveal('playing', -5)).toBeNull();
    });
});

describe('pickFlavorLine', () => {
    it('returns a non-empty line for every mood', () => {
        expect(pickFlavorLine('bust').length).toBeGreaterThan(0);
        expect(pickFlavorLine('win').length).toBeGreaterThan(0);
        expect(pickFlavorLine('close').length).toBeGreaterThan(0);
    });
});
