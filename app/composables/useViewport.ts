// SSR-safe media flags. Every flag is false on the server and before mount,
// then live via matchMedia listeners (registered once, by AppShell's
// onMounted calling init()). Layout is CSS-driven: use these only for
// behaviour (inline vs modal picker, key hints) or client-only UI.
import type { Ref } from 'vue';

const QUERIES = {
    isTablet: '(width >= 768px)',
    isWide: '(width >= 1024px)',
    finePointer: '(hover: hover) and (pointer: fine)',
} as const;

type Flag = keyof typeof QUERIES;

let listening = false;

export function useViewport(): {
    isTablet: Readonly<Ref<boolean>>;
    isWide: Readonly<Ref<boolean>>;
    finePointer: Readonly<Ref<boolean>>;
    init: () => void;
} {
    const flags = {
        isTablet: useState<boolean>('exact-xi-vp-tablet', () => false),
        isWide: useState<boolean>('exact-xi-vp-wide', () => false),
        finePointer: useState<boolean>('exact-xi-vp-fine', () => false),
    } satisfies Record<Flag, Ref<boolean>>;

    function init(): void {
        if (listening || !import.meta.client || typeof window.matchMedia !== 'function') {
            return;
        }

        listening = true;

        for (const flag of Object.keys(QUERIES) as Flag[]) {
            const media = window.matchMedia(QUERIES[flag]);

            flags[flag].value = media.matches;
            media.addEventListener('change', (event) => {
                flags[flag].value = event.matches;
            });
        }
    }

    return {
        isTablet: readonly(flags.isTablet),
        isWide: readonly(flags.isWide),
        finePointer: readonly(flags.finePointer),
        init,
    };
}
