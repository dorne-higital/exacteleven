const PLAYER_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
// A real game excludes at most 33 ids (11 slots x 3 candidates, before
// dedup) — these are generous multiples of that, not a tight fit.
const MAX_EXCLUDE_LENGTH = 2000;
const MAX_EXCLUDED_IDS = 60;

// Shared by /api/draw (excludes already-offered players from a fresh draw)
// and /api/win-odds (excludes them from the odds pool too, so the two agree
// on which players are still "in the deck").
export function parseExclude(raw: unknown): Set<string> {
    if (typeof raw !== 'string' || raw.length === 0) {
        return new Set();
    }

    if (raw.length > MAX_EXCLUDE_LENGTH) {
        throw createError({ statusCode: 400, statusMessage: 'exclude is too long.' });
    }

    const ids = raw.split(',').map((id) => id.trim()).filter(Boolean);

    if (ids.length > MAX_EXCLUDED_IDS) {
        throw createError({ statusCode: 400, statusMessage: `exclude accepts at most ${MAX_EXCLUDED_IDS} ids.` });
    }

    return new Set(ids.filter((id) => PLAYER_ID_PATTERN.test(id)));
}
