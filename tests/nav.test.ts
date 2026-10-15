import { describe, expect, it } from 'vitest';
import { activeNavId, navItemsFor } from '../app/utils/nav';

describe('nav registry', () => {
    it.each([
        ['/', 'play'],
        ['/select-formation', 'play'],
        ['/play?f=433', 'play'],
        ['/challenge?c=abc', 'play'],
        ['/daily', 'daily'],
        ['/daily-archive/', 'daily'],
        ['/stats/', 'stats'],
        ['/how-to-play', 'how_to_play'],
        ['/settings', 'settings'],
        ['/privacy', null],
        ['/nope', null],
    ])('lights %s up as %s', (path, id) => {
        expect(activeNavId(path)).toBe(id);
    });

    it('hides Modes until a mode is live, per build', () => {
        expect(navItemsFor('web').map(item => item.id)).toEqual(['play', 'daily', 'stats', 'how_to_play', 'settings']);
        expect(navItemsFor('app', [{ id: 'w', slug: 'w', name: 'W', status: 'live', build: 'web' }]).some(item => item.id === 'modes')).toBe(false);
        expect(navItemsFor('app', [{ id: 'w', slug: 'w', name: 'W', status: 'live' }]).some(item => item.id === 'modes')).toBe(true);
    });
});
