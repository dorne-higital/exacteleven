// The theme catalogue: the Appearance setting (system / light / dark, free on
// the web and in the app) and the Kit Bag — alternative palettes for the
// "Bib & Board" tokens, app-only, unlocked by Kit Bag (xkit) or Pro.
//
// How a theme reaches the screen:
// - Appearance sets data-theme="light" | "dark" on <html> (absent = follow
//   the system), which app.vue's token blocks already key off.
// - A kit sets data-kit="<id>" on <html> (absent = 'bib', the default), and
//   app.vue has one `:root[data-kit='<id>']` block per kit and mode that
//   overrides every colour token. The values below are the same values,
//   kept here for the picker swatches, theme-color and the contrast test —
//   tests/themes.test.ts fails if this file and app.vue ever drift apart.
//
// Kit modes: 'both' kits have a light and a dark palette and follow the
// Appearance setting; a 'dark' or 'light' kit is fixed to that one palette
// whatever Appearance says (a night match is never bright).

export type Appearance = 'system' | 'light' | 'dark';
export type ColorMode = 'light' | 'dark';
export type KitId = 'bib' | 'floodlights' | 'chalkboard' | 'programme' | 'away' | 'snow';
export type KitModes = 'both' | ColorMode;

export const APPEARANCES: readonly Appearance[] = ['system', 'light', 'dark'];
export const DEFAULT_APPEARANCE: Appearance = 'system';
export const DEFAULT_KIT: KitId = 'bib';

export const APPEARANCE_STORAGE_KEY = 'exact-xi-appearance';
export const KIT_STORAGE_KEY = 'exact-xi-kit';

// One kit palette = every colour token in app.vue that a kit overrides.
export interface KitPalette {
    background: string;
    surface: string;
    surface2: string;
    foreground: string;
    muted: string;
    line: string;
    primary: string;
    onPrimary: string;
    primaryStrong: string;
    bib: string;
    onBib: string;
    amber: string;
    teal: string;
    slate: string;
    pitch: string;
    pitchStripe: string;
    pitchLine: string;
    pitchInk: string;
    slotEmptyBg: string;
    slotFilledBg: string;
    slotFilledInk: string;
    shadowSm: string;
    shadowLg: string;
    texture: string;
    textureSize: string;
}

// Palette field -> the custom property app.vue declares for it.
export const PALETTE_CSS_VARS: Record<keyof KitPalette, string> = {
    background: '--color-background',
    surface: '--color-surface',
    surface2: '--color-surface-2',
    foreground: '--color-foreground',
    muted: '--color-muted',
    line: '--color-line',
    primary: '--color-primary',
    onPrimary: '--color-on-primary',
    primaryStrong: '--color-primary-strong',
    bib: '--color-bib',
    onBib: '--color-on-bib',
    amber: '--color-amber',
    teal: '--color-teal',
    slate: '--color-slate',
    pitch: '--color-pitch',
    pitchStripe: '--color-pitch-stripe',
    pitchLine: '--color-pitch-line',
    pitchInk: '--color-pitch-ink',
    slotEmptyBg: '--slot-empty-bg',
    slotFilledBg: '--slot-filled-bg',
    slotFilledInk: '--slot-filled-ink',
    shadowSm: '--shadow-sm',
    shadowLg: '--shadow-lg',
    texture: '--body-texture',
    textureSize: '--body-texture-size',
};

/** What a picker draws for a kit: page, pitch, accent (the bib colour) and ink. */
export interface KitSwatch {
    background: string;
    pitch: string;
    accent: string;
    ink: string;
}

export interface Kit {
    id: KitId;
    name: string;
    blurb: string;
    modes: KitModes;
    /** Free for everyone (only 'bib'); every other kit needs Kit Bag or Pro. */
    free: boolean;
    /** Present when modes is 'both' or 'light'. */
    light?: KitPalette;
    /** Present when modes is 'both' or 'dark'. */
    dark?: KitPalette;
    /** The swatch of the kit's main look (light for 'both' kits). */
    swatch: KitSwatch;
}

// ------------------------------------------------------------------ palettes

const BIB_LIGHT: KitPalette = {
    background: '#f3f5f1',
    surface: '#fff',
    surface2: '#e8ede7',
    foreground: '#0f1d16',
    muted: '#5b6b62',
    line: 'rgb(15 29 22 / 12%)',
    primary: '#0e7a52',
    onPrimary: '#fff',
    primaryStrong: '#08402b',
    bib: '#da291c',
    onBib: '#fff',
    amber: '#b87900',
    teal: '#0f7480',
    slate: '#4f5d66',
    pitch: '#13865c',
    pitchStripe: '#0f7a53',
    pitchLine: 'rgb(255 255 255 / 55%)',
    pitchInk: '#fff',
    slotEmptyBg: 'rgb(255 255 255 / 8%)',
    slotFilledBg: '#fff',
    slotFilledInk: '#0f1d16',
    shadowSm: '0 1px 2px rgb(15 29 22 / 6%)',
    shadowLg: '0 18px 48px rgb(15 29 22 / 22%)',
    texture: 'none',
    textureSize: 'auto',
};

const BIB_DARK: KitPalette = {
    ...BIB_LIGHT,
    background: '#0b1410',
    surface: '#15221b',
    surface2: '#1d2c24',
    foreground: '#eaf2ed',
    muted: '#8fa398',
    line: 'rgb(234 242 237 / 12%)',
    primary: '#31c58a',
    onPrimary: '#04130b',
    primaryStrong: '#020a06',
    bib: '#ff5a4a',
    onBib: '#1a0402',
    amber: '#f0b43c',
    teal: '#3fc1c9',
    slate: '#a3b0b8',
    pitch: '#0f4a33',
    pitchStripe: '#0d422e',
    pitchLine: 'rgb(255 255 255 / 30%)',
    pitchInk: '#eaf2ed',
    slotEmptyBg: 'rgb(255 255 255 / 5%)',
    slotFilledBg: '#eaf2ed',
    slotFilledInk: '#0b1410',
    shadowSm: 'none',
    shadowLg: '0 18px 48px rgb(0 0 0 / 50%)',
};

// Night match: a deep navy sky, the pitch lit green below it, and the
// sodium-amber glow of the floodlights as the accent. Fixed dark.
const FLOODLIGHTS: KitPalette = {
    background: '#070d1c',
    surface: '#0f1830',
    surface2: '#17223f',
    foreground: '#eef2ff',
    muted: '#97a3c4',
    line: 'rgb(238 242 255 / 12%)',
    primary: '#5ad6a0',
    onPrimary: '#03140c',
    primaryStrong: '#02060f',
    bib: '#ffa62b',
    onBib: '#1f1100',
    amber: '#ffd27a',
    teal: '#5fd0e0',
    slate: '#a9b3cc',
    pitch: '#0f4033',
    pitchStripe: '#0d382d',
    pitchLine: 'rgb(255 255 255 / 34%)',
    pitchInk: '#eef2ff',
    slotEmptyBg: 'rgb(255 255 255 / 6%)',
    slotFilledBg: '#eef2ff',
    slotFilledInk: '#070d1c',
    shadowSm: 'none',
    shadowLg: '0 18px 48px rgb(0 0 0 / 60%)',
    texture: 'radial-gradient(ellipse 60% 40% at 12% -8%, rgb(255 196 110 / 11%), transparent 70%), radial-gradient(ellipse 60% 40% at 88% -8%, rgb(255 196 110 / 11%), transparent 70%)',
    textureSize: 'auto',
};

// The dressing-room tactics board: green-black slate, chalk-white ink and
// a chalk-yellow accent, with faint smudges where the last plan was wiped.
// Fixed dark.
const CHALKBOARD: KitPalette = {
    background: '#1a2321',
    surface: '#232e2c',
    surface2: '#2c3836',
    foreground: '#f1efe6',
    muted: '#a8b2ac',
    line: 'rgb(241 239 230 / 16%)',
    primary: '#9fd8b4',
    onPrimary: '#0f1f17',
    primaryStrong: '#0b100f',
    bib: '#f5d76e',
    onBib: '#231c02',
    amber: '#f4a96a',
    teal: '#93d2d6',
    slate: '#b8c0c4',
    pitch: '#2a3a35',
    pitchStripe: '#273631',
    pitchLine: 'rgb(241 239 230 / 45%)',
    pitchInk: '#f1efe6',
    slotEmptyBg: 'rgb(241 239 230 / 6%)',
    slotFilledBg: '#f1efe6',
    slotFilledInk: '#1a2321',
    shadowSm: 'none',
    shadowLg: '0 18px 48px rgb(0 0 0 / 55%)',
    texture: 'radial-gradient(ellipse 50% 30% at 18% 28%, rgb(241 239 230 / 5%), transparent 70%), radial-gradient(ellipse 45% 25% at 82% 72%, rgb(241 239 230 / 4%), transparent 70%)',
    textureSize: 'auto',
};

// A retro matchday programme: cream paper, navy ink, a faded red and a
// fine halftone. The dark version is the same programme read under the
// stand lights — navy paper, cream ink.
const PROGRAMME_LIGHT: KitPalette = {
    background: '#f1e8d4',
    surface: '#fbf6ea',
    surface2: '#e7dcc4',
    foreground: '#1b2338',
    muted: '#5b5546',
    line: 'rgb(27 35 56 / 16%)',
    primary: '#1f3d6e',
    onPrimary: '#fbf6ea',
    primaryStrong: '#0f1c33',
    bib: '#a8322a',
    onBib: '#fff8ec',
    amber: '#8a5a00',
    teal: '#1c6670',
    slate: '#4b5466',
    pitch: '#3d6a3f',
    pitchStripe: '#386239',
    pitchLine: 'rgb(251 246 234 / 55%)',
    pitchInk: '#fbf6ea',
    slotEmptyBg: 'rgb(251 246 234 / 8%)',
    slotFilledBg: '#fbf6ea',
    slotFilledInk: '#1b2338',
    shadowSm: '0 1px 0 rgb(27 35 56 / 10%)',
    shadowLg: '0 18px 40px rgb(27 35 56 / 22%)',
    texture: 'radial-gradient(rgb(27 35 56 / 6%) 1px, transparent 1.2px)',
    textureSize: '6px 6px',
};

const PROGRAMME_DARK: KitPalette = {
    background: '#131a2b',
    surface: '#1b2338',
    surface2: '#242d45',
    foreground: '#f3ead6',
    muted: '#aea690',
    line: 'rgb(243 234 214 / 13%)',
    primary: '#93b4e6',
    onPrimary: '#0d1424',
    primaryStrong: '#070b15',
    bib: '#f07a6c',
    onBib: '#220805',
    amber: '#e8b65c',
    teal: '#72c4ca',
    slate: '#adb4c4',
    pitch: '#28452c',
    pitchStripe: '#243e27',
    pitchLine: 'rgb(243 234 214 / 32%)',
    pitchInk: '#f3ead6',
    slotEmptyBg: 'rgb(243 234 214 / 5%)',
    slotFilledBg: '#f3ead6',
    slotFilledInk: '#131a2b',
    shadowSm: 'none',
    shadowLg: '0 18px 48px rgb(0 0 0 / 55%)',
    texture: 'radial-gradient(rgb(243 234 214 / 4%) 1px, transparent 1.2px)',
    textureSize: '6px 6px',
};

// The away kit: sky blue and navy, with the board itself drawn in sky blue.
// Navy is the accent in daylight; under the dark appearance the accent
// flips to the bright sky blue of the shirt.
const AWAY_LIGHT: KitPalette = {
    background: '#eef5fb',
    surface: '#fff',
    surface2: '#dceaf6',
    foreground: '#0d1f3c',
    muted: '#4c5f7c',
    line: 'rgb(13 31 60 / 12%)',
    primary: '#1a65a8',
    onPrimary: '#fff',
    primaryStrong: '#0a2445',
    bib: '#14306a',
    onBib: '#fff',
    amber: '#9b6100',
    teal: '#0d6d78',
    slate: '#4d5b6e',
    pitch: '#2a6aa8',
    pitchStripe: '#26619a',
    pitchLine: 'rgb(255 255 255 / 55%)',
    pitchInk: '#fff',
    slotEmptyBg: 'rgb(255 255 255 / 8%)',
    slotFilledBg: '#fff',
    slotFilledInk: '#0d1f3c',
    shadowSm: '0 1px 2px rgb(13 31 60 / 7%)',
    shadowLg: '0 18px 48px rgb(13 31 60 / 22%)',
    texture: 'none',
    textureSize: 'auto',
};

const AWAY_DARK: KitPalette = {
    background: '#091326',
    surface: '#101e3b',
    surface2: '#17284b',
    foreground: '#e8f1fb',
    muted: '#93a8c6',
    line: 'rgb(232 241 251 / 12%)',
    primary: '#6cb5f0',
    onPrimary: '#04122a',
    primaryStrong: '#020814',
    bib: '#8fd0ff',
    onBib: '#04122a',
    amber: '#f0b43c',
    teal: '#4fc6d0',
    slate: '#a5b2c6',
    pitch: '#143b69',
    pitchStripe: '#12355f',
    pitchLine: 'rgb(255 255 255 / 30%)',
    pitchInk: '#e8f1fb',
    slotEmptyBg: 'rgb(255 255 255 / 5%)',
    slotFilledBg: '#e8f1fb',
    slotFilledInk: '#091326',
    shadowSm: 'none',
    shadowLg: '0 18px 48px rgb(0 0 0 / 55%)',
    texture: 'none',
    textureSize: 'auto',
};

// A winter fixture: crisp ice-white page, a frosted pitch, and the orange
// winter ball as the accent. Fixed light. (The pitch stays mid-toned rather
// than white so the white pitch lines and chips still read on it.)
const SNOW: KitPalette = {
    background: '#f4f8fb',
    surface: '#fff',
    surface2: '#e2ecf3',
    foreground: '#0f2233',
    muted: '#4f6476',
    line: 'rgb(15 34 51 / 12%)',
    primary: '#1b6a92',
    onPrimary: '#fff',
    primaryStrong: '#0b2e44',
    bib: '#e0620a',
    onBib: '#1f0d00',
    amber: '#9a6200',
    teal: '#0e6c79',
    slate: '#4d5d6b',
    pitch: '#2f6e7a',
    pitchStripe: '#2b6570',
    pitchLine: 'rgb(255 255 255 / 60%)',
    pitchInk: '#fff',
    slotEmptyBg: 'rgb(255 255 255 / 10%)',
    slotFilledBg: '#fff',
    slotFilledInk: '#0f2233',
    shadowSm: '0 1px 2px rgb(15 34 51 / 6%)',
    shadowLg: '0 18px 48px rgb(15 34 51 / 20%)',
    texture: 'radial-gradient(rgb(27 106 146 / 7%) 1.2px, transparent 1.6px)',
    textureSize: '14px 14px',
};

function swatchOf(palette: KitPalette): KitSwatch {
    return { background: palette.background, pitch: palette.pitch, accent: palette.bib, ink: palette.foreground };
}

export const KITS: readonly Kit[] = [
    {
        id: 'bib',
        name: 'Bib & Board',
        blurb: 'The training-ground original. Pitch green, red bib.',
        modes: 'both',
        free: true,
        light: BIB_LIGHT,
        dark: BIB_DARK,
        swatch: swatchOf(BIB_LIGHT),
    },
    {
        id: 'floodlights',
        name: 'Floodlights',
        blurb: 'Midweek under the lights. Navy sky, amber glow.',
        modes: 'dark',
        free: false,
        dark: FLOODLIGHTS,
        swatch: swatchOf(FLOODLIGHTS),
    },
    {
        id: 'chalkboard',
        name: 'Chalkboard',
        blurb: 'The half-time tactics board, in chalk.',
        modes: 'dark',
        free: false,
        dark: CHALKBOARD,
        swatch: swatchOf(CHALKBOARD),
    },
    {
        id: 'programme',
        name: 'Programme',
        blurb: 'A vintage matchday programme. Cream paper, navy ink.',
        modes: 'both',
        free: false,
        light: PROGRAMME_LIGHT,
        dark: PROGRAMME_DARK,
        swatch: swatchOf(PROGRAMME_LIGHT),
    },
    {
        id: 'away',
        name: 'Away Day',
        blurb: 'Sky blue and navy, packed for the trip.',
        modes: 'both',
        free: false,
        light: AWAY_LIGHT,
        dark: AWAY_DARK,
        swatch: swatchOf(AWAY_LIGHT),
    },
    {
        id: 'snow',
        name: 'Winter Fixture',
        blurb: 'Frost on the pitch and the orange ball out.',
        modes: 'light',
        free: false,
        light: SNOW,
        swatch: swatchOf(SNOW),
    },
];

// ------------------------------------------------------------------ helpers

export function isAppearance(value: unknown): value is Appearance {
    return typeof value === 'string' && (APPEARANCES as readonly string[]).includes(value);
}

export function isKitId(value: unknown): value is KitId {
    return typeof value === 'string' && KITS.some((kit) => kit.id === value);
}

export function getKit(id: string): Kit {
    return KITS.find((kit) => kit.id === id) ?? (KITS[0] as Kit);
}

export function kitIsUnlocked(kit: Kit, hasThemes: boolean): boolean {
    return kit.free || hasThemes;
}

/**
 * The kit actually worn: the saved choice, unless it no longer exists, the
 * kits aren't offered here (the website), or its unlock has gone (a refund,
 * a reinstall that hasn't restored yet) — then the default, silently.
 */
export function effectiveKit(saved: string, hasThemes: boolean, kitsOffered: boolean): KitId {
    if (!kitsOffered || !isKitId(saved)) {
        return DEFAULT_KIT;
    }

    return kitIsUnlocked(getKit(saved), hasThemes) ? saved : DEFAULT_KIT;
}

/** Light or dark on screen, for this appearance, kit and system setting. */
export function resolveMode(appearance: Appearance, kitId: KitId, systemDark: boolean): ColorMode {
    const { modes } = getKit(kitId);

    if (modes !== 'both') {
        return modes;
    }

    if (appearance === 'system') {
        return systemDark ? 'dark' : 'light';
    }

    return appearance;
}

export function kitPalette(kitId: KitId, mode: ColorMode): KitPalette {
    const kit = getKit(kitId);

    return (mode === 'dark' ? kit.dark ?? kit.light : kit.light ?? kit.dark) as KitPalette;
}

/** The page background for the browser/status-bar tint, as theme-color wants it. */
export function themeColor(appearance: Appearance, kitId: KitId, systemDark: boolean): string {
    return kitPalette(kitId, resolveMode(appearance, kitId, systemDark)).background;
}

/** Puts a theme on <html>: data-theme for a forced appearance, data-kit for a non-default kit. */
export function applyThemeAttributes(root: HTMLElement, appearance: Appearance, kitId: KitId): void {
    if (appearance === 'system') {
        root.removeAttribute('data-theme');
    } else if (root.getAttribute('data-theme') !== appearance) {
        root.setAttribute('data-theme', appearance);
    }

    if (kitId === DEFAULT_KIT) {
        root.removeAttribute('data-kit');
    } else if (root.getAttribute('data-kit') !== kitId) {
        root.setAttribute('data-kit', kitId);
    }
}

/**
 * The inline <head> script for the server-rendered website: sets data-theme
 * from the saved Appearance before the first paint, so a forced light/dark
 * choice never flashes the system one first. No kits on the web.
 */
export function themeBootScript(): string {
    return `(function(){try{var a=localStorage.getItem('${APPEARANCE_STORAGE_KEY}');if(a==='light'||a==='dark'){document.documentElement.setAttribute('data-theme',a);}}catch(e){}})();`;
}

// ------------------------------------------------------------------ contrast (WCAG 2.x)

/** '#rgb' / '#rrggbb' to [r, g, b] (0-255), or null for anything else. */
export function parseHex(color: string): [number, number, number] | null {
    const match = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(color.trim());

    if (!match) {
        return null;
    }

    const hex = (match[1] as string).length === 3
        ? [...(match[1] as string)].map((c) => c + c).join('')
        : (match[1] as string);

    return [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

export function relativeLuminance(color: string): number {
    const rgb = parseHex(color);

    if (!rgb) {
        throw new Error(`Not a hex colour: ${color}`);
    }

    const [r, g, b] = rgb.map((channel) => {
        const c = channel / 255;

        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);

    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
