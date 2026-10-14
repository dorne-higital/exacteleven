import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ref } from 'vue';
import type { Ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTheme } from '../app/composables/useTheme';
import {
    APPEARANCE_STORAGE_KEY,
    DEFAULT_KIT,
    KITS,
    PALETTE_CSS_VARS,
    applyThemeAttributes,
    contrastRatio,
    effectiveKit,
    getKit,
    kitPalette,
    resolveMode,
    themeBootScript,
    themeColor,
} from '../app/utils/themes';
import type { ColorMode, Kit, KitPalette } from '../app/utils/themes';

// Every (kit, mode) palette the catalogue defines.
function palettes(): Array<{ label: string; kit: Kit; mode: ColorMode; palette: KitPalette }> {
    return KITS.flatMap((kit) => (['light', 'dark'] as const)
        .filter((mode) => kit[mode])
        .map((mode) => ({ label: `${kit.id} ${mode}`, kit, mode, palette: kit[mode] as KitPalette })));
}

describe('kit catalogue', () => {
    it('has Bib & Board as the free default plus five locked kits', () => {
        expect(KITS.map((kit) => kit.id)).toEqual(['bib', 'floodlights', 'chalkboard', 'programme', 'away', 'snow']);
        expect(KITS.filter((kit) => kit.free).map((kit) => kit.id)).toEqual([DEFAULT_KIT]);
        expect(getKit('nope').id).toBe(DEFAULT_KIT);
    });

    it('defines exactly the palettes its modes promise, with a matching swatch', () => {
        for (const kit of KITS) {
            expect(Boolean(kit.light), `${kit.id} light`).toBe(kit.modes !== 'dark');
            expect(Boolean(kit.dark), `${kit.id} dark`).toBe(kit.modes !== 'light');
            expect(kit.name.length).toBeGreaterThan(0);
            expect(kit.blurb.length).toBeGreaterThan(0);

            const main = (kit.light ?? kit.dark) as KitPalette;

            expect(kit.swatch).toEqual({ background: main.background, pitch: main.pitch, accent: main.bib, ink: main.foreground });
        }
    });
});

// WCAG 2.x AA: 4.5:1 for body text, 3:1 for large/bold text and UI parts.
// The accent (--color-bib) and the support colours are used for bold
// labels, icons and borders, so 3:1 against the page; everything that
// carries normal-size text must reach 4.5:1.
const TEXT_PAIRS: Array<[keyof KitPalette, keyof KitPalette]> = [
    ['foreground', 'background'],
    ['foreground', 'surface'],
    ['foreground', 'surface2'],
    ['muted', 'background'],
    ['muted', 'surface'],
    ['muted', 'surface2'],
    ['onPrimary', 'primary'],
    ['onBib', 'bib'],
    ['primary', 'background'],
    ['primary', 'surface'],
    ['pitchInk', 'pitch'],
    ['pitchInk', 'pitchStripe'],
    ['slotFilledInk', 'slotFilledBg'],
];
const UI_PAIRS: Array<[keyof KitPalette, keyof KitPalette]> = [
    ['bib', 'background'],
    ['bib', 'surface'],
    ['amber', 'background'],
    ['amber', 'surface'],
    ['teal', 'background'],
    ['slate', 'background'],
    ['slate', 'surface'],
];

describe('kit contrast (WCAG AA)', () => {
    it.each(palettes())('$label: text pairs reach 4.5:1', ({ palette }) => {
        for (const [ink, bg] of TEXT_PAIRS) {
            expect(contrastRatio(palette[ink], palette[bg]), `${ink} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
    });

    it.each(palettes())('$label: accent and support colours reach 3:1', ({ palette }) => {
        for (const [fg, bg] of UI_PAIRS) {
            expect(contrastRatio(palette[fg], palette[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(3);
        }
    });

    it('computes the WCAG ratio', () => {
        expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5);
        expect(contrastRatio('#fff', '#fff')).toBe(1);
        expect(() => contrastRatio('rgb(0 0 0)', '#fff')).toThrow();
    });
});

// app.vue holds the same values as CSS; this keeps the two from drifting.
describe('app.vue tokens match the catalogue', () => {
    const appVue = readFileSync(resolve(process.cwd(), 'app/app.vue'), 'utf8');

    function declarations(block: string): Map<string, string> {
        const out = new Map<string, string>();

        for (const match of block.matchAll(/^\s*(--[a-z0-9-]+):\s*(.+);\s*$/gm)) {
            out.set(match[1] as string, (match[2] as string).trim());
        }

        return out;
    }

    function blockAfter(header: string): Map<string, string> {
        const start = appVue.indexOf(`\n${header} {\n`);

        expect(start, header).toBeGreaterThan(-1);

        const end = appVue.indexOf('\n}\n', start + 1);

        return declarations(appVue.slice(start, end));
    }

    function expectPalette(palette: KitPalette, declared: Map<string, string>, label: string): void {
        for (const [key, cssVar] of Object.entries(PALETTE_CSS_VARS)) {
            expect(declared.get(cssVar), `${label} ${cssVar}`).toBe(palette[key as keyof KitPalette]);
        }
    }

    it('Bib & Board light = :root, dark = the dark-tokens mixin over :root', () => {
        const root = blockAfter(':root');
        const dark = new Map([...root, ...blockAfter('@mixin dark-tokens')]);

        expectPalette(kitPalette('bib', 'light'), root, 'bib light');
        expectPalette(kitPalette('bib', 'dark'), dark, 'bib dark');
    });

    it.each(KITS.filter((kit) => kit.id !== DEFAULT_KIT))('$id has a full mixin per mode and a data-kit selector', (kit) => {
        for (const mode of ['light', 'dark'] as const) {
            const palette = kit[mode];

            if (!palette) {
                continue;
            }

            const mixin = kit.modes === 'both' ? `kit-${kit.id}-${mode}` : `kit-${kit.id}`;

            expectPalette(palette, blockAfter(`@mixin ${mixin}`), mixin);
            expect(appVue).toContain(`@include ${mixin};`);
        }

        expect(appVue).toContain(`:root[data-kit='${kit.id}']`);
    });
});

describe('theme rules', () => {
    it('falls back to Bib & Board when a kit is locked, unknown or not offered', () => {
        expect(effectiveKit('floodlights', true, true)).toBe('floodlights');
        expect(effectiveKit('floodlights', false, true)).toBe(DEFAULT_KIT);
        expect(effectiveKit('floodlights', true, false)).toBe(DEFAULT_KIT);
        expect(effectiveKit('retired-kit', true, true)).toBe(DEFAULT_KIT);
        expect(effectiveKit('bib', false, true)).toBe('bib');
    });

    it('follows the appearance for light+dark kits and ignores it for fixed ones', () => {
        expect(resolveMode('system', 'bib', true)).toBe('dark');
        expect(resolveMode('system', 'bib', false)).toBe('light');
        expect(resolveMode('light', 'programme', true)).toBe('light');
        expect(resolveMode('dark', 'away', false)).toBe('dark');
        expect(resolveMode('light', 'floodlights', false)).toBe('dark');
        expect(resolveMode('dark', 'snow', true)).toBe('light');
    });

    it('tints theme-color with the page background on screen', () => {
        // The server-rendered default is exactly the pair app.vue used to hard-code.
        expect(themeColor('system', 'bib', false)).toBe('#f3f5f1');
        expect(themeColor('system', 'bib', true)).toBe('#0b1410');
        expect(themeColor('light', 'bib', true)).toBe('#f3f5f1');
        expect(themeColor('system', 'floodlights', false)).toBe(kitPalette('floodlights', 'dark').background);
    });

    it('puts data-theme / data-kit on <html> only when they differ from the defaults', () => {
        const root = document.createElement('html');

        applyThemeAttributes(root, 'dark', 'programme');
        expect(root.getAttribute('data-theme')).toBe('dark');
        expect(root.getAttribute('data-kit')).toBe('programme');

        applyThemeAttributes(root, 'system', 'bib');
        expect(root.hasAttribute('data-theme')).toBe(false);
        expect(root.hasAttribute('data-kit')).toBe(false);
    });

    it('boot script sets a saved light/dark appearance and ignores anything else', () => {
        const root = document.documentElement;

        try {
            for (const [saved, expected] of [['dark', 'dark'], ['light', 'light'], ['system', null], ['<x>', null]] as const) {
                root.removeAttribute('data-theme');
                window.localStorage.setItem(APPEARANCE_STORAGE_KEY, saved);
                new Function(themeBootScript())();
                expect(root.getAttribute('data-theme')).toBe(expected);
            }
        } finally {
            root.removeAttribute('data-theme');
            window.localStorage.removeItem(APPEARANCE_STORAGE_KEY);
        }
    });
});

// Same fakeUseState stubbing as useGame.test.ts. import.meta.client is
// falsy under plain vitest, so storage, <html> and analytics writes are
// no-ops here; this covers the state rules (locking, fallback, web vs app).
const stateStore = new Map<string, Ref<unknown>>();

function fakeUseState<T>(key: string, init?: () => T): Ref<T> {
    if (!stateStore.has(key)) {
        stateStore.set(key, ref(init ? init() : undefined));
    }

    return stateStore.get(key) as Ref<T>;
}

function stubBuild(isApp: boolean): void {
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { isApp } }));
}

describe('useTheme', () => {
    beforeEach(() => {
        stateStore.clear();
        vi.stubGlobal('useState', fakeUseState);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('offers only Bib & Board on the website and refuses kits there', () => {
        stubBuild(false);
        stateStore.set('exact-xi-iap-themes', ref(true));

        const theme = useTheme();

        expect(theme.availableKits.value.map((kit) => kit.id)).toEqual(['bib']);
        expect(theme.setKit('floodlights')).toBe(false);
        expect(theme.kit.value).toBe('bib');
    });

    it('lets anyone change the appearance', () => {
        stubBuild(false);

        const theme = useTheme();

        expect(theme.appearance.value).toBe('system');
        theme.setAppearance('dark');
        expect(theme.appearance.value).toBe('dark');
        expect(theme.mode.value).toBe('dark');
        expect(theme.browserTheme.value).toEqual({ light: '#0b1410', dark: '#0b1410', colorScheme: 'dark' });
        theme.setAppearance('nonsense' as never);
        expect(theme.appearance.value).toBe('dark');
    });

    it('locks kits in the app until Kit Bag or Pro', () => {
        stubBuild(true);

        const theme = useTheme();

        expect(theme.availableKits.value).toHaveLength(KITS.length);
        expect(theme.availableKits.value.filter((kit) => kit.locked).map((kit) => kit.id))
            .toEqual(['floodlights', 'chalkboard', 'programme', 'away', 'snow']);
        expect(theme.setKit('chalkboard')).toBe(false);
        expect(theme.kit.value).toBe('bib');
        expect(theme.setKit('bib')).toBe(true);
    });

    it('wears an unlocked kit and falls back silently when the unlock goes', () => {
        stubBuild(true);
        const themesEntitlement = ref(true);
        stateStore.set('exact-xi-iap-themes', themesEntitlement);

        const theme = useTheme();

        expect(theme.availableKits.value.every((kit) => !kit.locked)).toBe(true);
        expect(theme.setKit('floodlights')).toBe(true);
        expect(theme.kit.value).toBe('floodlights');
        // Fixed dark, whatever the appearance says
        theme.setAppearance('light');
        expect(theme.mode.value).toBe('dark');

        // Refunded / not restored on a new device
        themesEntitlement.value = false;
        expect(theme.kit.value).toBe('bib');
        expect(theme.mode.value).toBe('light');

        // Restored again: the saved choice comes back by itself
        themesEntitlement.value = true;
        expect(theme.kit.value).toBe('floodlights');
    });

    it('treats Pro as unlocking every kit', () => {
        stubBuild(true);
        stateStore.set('exact-xi-iap-pro', ref(true));

        const theme = useTheme();

        expect(theme.setKit('snow')).toBe(true);
        expect(theme.kit.value).toBe('snow');
    });
});
