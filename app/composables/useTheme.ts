export type ThemeId = 'match-programme' | 'dugout-dark';

const THEME_STORAGE_KEY = 'exact-xi-theme';
const THEME_IDS: ThemeId[] = ['match-programme', 'dugout-dark'];

function isThemeId(value: string | null): value is ThemeId {
    return value !== null && (THEME_IDS as string[]).includes(value);
}

// `data-theme` on <html> drives app.vue's `:root[data-theme='...']` token
// overrides. Match Programme is the implicit default — it's expressed as
// the absence of the attribute, not its own value, so a fresh visitor with
// no stored preference gets it automatically.
function applyThemeAttribute(id: ThemeId): void {
    if (id === 'match-programme') {
        document.documentElement.removeAttribute('data-theme');
    } else {
        document.documentElement.setAttribute('data-theme', id);
    }
}

export function useTheme() {
    const theme = useState<ThemeId>('exact-xi-theme', () => 'match-programme');

    function setTheme(id: ThemeId): void {
        theme.value = id;

        if (import.meta.client) {
            applyThemeAttribute(id);

            try {
                window.localStorage.setItem(THEME_STORAGE_KEY, id);
            } catch {
                // Private-mode/blocked storage — the theme still applies for
                // this session via reactive state, it just won't persist.
            }
        }
    }

    // Called once from app.vue's onMounted: reads any stored preference and
    // applies it. Runs after hydration (client-only), so a returning
    // Dugout Dark visitor briefly sees the Match Programme default first —
    // an accepted tradeoff for not needing a blocking pre-hydration script.
    function initTheme(): void {
        if (!import.meta.client) {
            return;
        }

        try {
            const stored = window.localStorage.getItem(THEME_STORAGE_KEY);

            if (isThemeId(stored)) {
                theme.value = stored;
            }
        } catch {
            // Ignore — falls back to the default already set above.
        }

        applyThemeAttribute(theme.value);
    }

    return { theme, setTheme, initTheme };
}
