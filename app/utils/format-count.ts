// /api/win-odds' counts routinely run into the millions/billions+ (see its
// own comment on why that's an accepted approximation) — a full digit string
// at that size reads as noise, so anything past 5 figures switches to a
// compact "2.4M" form. Below that, an exact grouped number is more useful
// (and is often the more interesting case anyway — a small number of ways
// left tends to show up right when it matters, late in a game).
const COMPACT_THRESHOLD = 100_000;

// A handful of remaining slots, each with a pool in the hundreds, multiplies
// out well past a trillion — but Intl's "compact" notation only defines
// named units up to trillion ('tn'/'T'). Past that it keeps dividing by
// 10^12 and leaves the (still huge) remainder spelled out in full rather
// than abbreviating further, e.g. "22,164,388,045,943.7tn" instead of
// anything short. Scientific notation has no such ceiling, so it takes over
// once the count is bigger than compact notation can meaningfully shorten.
const SCIENTIFIC_THRESHOLD = 1_000_000_000_000;

export function formatWinCount(value: number): string {
    if (!Number.isFinite(value) || value <= 0) {
        return '0';
    }

    const rounded = Math.round(value);

    if (rounded < COMPACT_THRESHOLD) {
        return rounded.toLocaleString('en-GB');
    }

    if (rounded < SCIENTIFIC_THRESHOLD) {
        return new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(rounded);
    }

    return new Intl.NumberFormat('en-GB', { notation: 'scientific', maximumFractionDigits: 2 }).format(rounded);
}
