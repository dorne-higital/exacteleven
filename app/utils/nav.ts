// The single nav registry: the desktop rail (DesktopRail.vue) reads it, and
// so will any future app tab bar. Pure data + pure functions, so it's
// unit-tested in tests/nav.test.ts.
import type { AppIconName } from './icons';

export type NavId = 'play' | 'daily' | 'modes' | 'stats' | 'how_to_play' | 'settings';
export type Build = 'web' | 'app';

export interface NavItem {
    id: NavId;
    to: string;
    label: string;
    icon: AppIconName;
    // Which routes light this item up (path without a trailing slash).
    match: (path: string) => boolean;
    // Omitted = both builds.
    build?: Build;
}

// Future modes register here. The rail shows "Modes" once any is live; each
// mode's page lives at /modes/<slug> (or its own route) and lights up the
// "modes" item.
export interface ModeEntry {
    id: string;
    slug: string;
    name: string;
    status: 'soon' | 'live';
    build?: Build;
}

export const MODES: ModeEntry[] = [
    // { id: 'weekly_xi', slug: 'weekly-xi', name: 'Weekly XI', status: 'soon' },
    // gauntlet, hardcore, head_to_head, speed_run, target_roulette, live_events
];

const PLAY_PREFIXES = ['/play', '/select-formation', '/challenge'];

export const NAV_ITEMS: NavItem[] = [
    { id: 'play', to: '/', label: 'Play', icon: 'pitch', match: p => p === '/' || PLAY_PREFIXES.some(prefix => p.startsWith(prefix)) },
    // Includes /daily-archive
    { id: 'daily', to: '/daily', label: 'Daily', icon: 'calendar', match: p => p.startsWith('/daily') },
    { id: 'modes', to: '/modes', label: 'Modes', icon: 'grid', match: p => p.startsWith('/modes') },
    { id: 'stats', to: '/stats', label: 'Stats', icon: 'stats', match: p => p.startsWith('/stats') },
    { id: 'how_to_play', to: '/how-to-play', label: 'How to play', icon: 'info', match: p => p.startsWith('/how-to-play') },
    { id: 'settings', to: '/settings', label: 'Settings', icon: 'gear', match: p => p.startsWith('/settings') },
];

function forBuild(build: Build): (entry: { build?: Build }) => boolean {
    return entry => entry.build === undefined || entry.build === build;
}

export function hasLiveModes(build: Build, modes: ModeEntry[] = MODES): boolean {
    return modes.filter(forBuild(build)).some(mode => mode.status === 'live');
}

export function navItemsFor(build: Build, modes: ModeEntry[] = MODES): NavItem[] {
    return NAV_ITEMS.filter(forBuild(build)).filter(item => item.id !== 'modes' || hasLiveModes(build, modes));
}

export function normalisePath(path: string): string {
    const bare = path.split(/[?#]/)[0] ?? '';
    const trimmed = bare.replace(/\/+$/, '');

    return trimmed === '' ? '/' : trimmed;
}

export function activeNavId(path: string): NavId | null {
    const clean = normalisePath(path);

    return NAV_ITEMS.find(item => item.match(clean))?.id ?? null;
}

// The existing per-screen "view_*" event a rail click also fires (with
// source: 'rail'), so today's funnels keep counting rail traffic.
export const NAV_VIEW_EVENT: Partial<Record<NavId, string>> = {
    daily: 'view_daily_challenge',
    stats: 'view_stats',
    how_to_play: 'view_how_to_play',
    settings: 'view_settings',
};
