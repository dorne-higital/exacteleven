import type { GameStatus } from '../../shared/types';

export type RevealMood = 'bust' | 'win' | 'close';

// How near the just-revealed number is to whatever ceiling matters for the
// current objective, unified across every game mode: classic/'exact'/'under'
// measure the running total against its ceiling; 'allUnder' measures the
// picked player's OWN stat against the per-player cap; 'over' has no
// ceiling at all, so it's never "close" (always pass null for it).
const CLOSE_THRESHOLD = 15;

export function classifyReveal(status: GameStatus, marginToLimit: number | null): RevealMood | null {
    if (status === 'bust') {
        return 'bust';
    }

    if (status === 'won') {
        return 'win';
    }

    if (marginToLimit !== null && marginToLimit >= 0 && marginToLimit <= CLOSE_THRESHOLD) {
        return 'close';
    }

    return null;
}

// Short and a little cheeky, never mean — these show up right after a real
// pick, so they sit alongside the player's own name/number, not instead of it.
const FLAVOR_LINES: Record<RevealMood, string[]> = {
    bust: [
        'Well, that escalated quickly.',
        'Bust. The house always wins.',
        'That one was never coming back.',
        'Over the line. Game over.',
        "Ouch. That's a wrap.",
        "Full-time whistle. That's your lot.",
        'Sent off — no arguing with VAR on this one.',
        'Straight past the post and into row Z.',
    ],
    win: [
        'Nailed it. On the nose.',
        'Precision finishing.',
        "That's exactly what we needed.",
        'Perfect landing.',
        'Right on target.',
        'Top corner. Textbook.',
        'Straight through the eye of the needle.',
        'Not a stat wasted.',
    ],
    close: [
        "That's cutting it fine.",
        'Living dangerously.',
        'One more like that and it\'s over.',
        'Tightrope stuff.',
        'No room left to breathe.',
        'Squeaked that one past the keeper.',
        'Somehow still standing.',
        'Fine margins. Very fine.',
    ],
};

// Avoids showing the same line twice in a row for a given mood — a session-
// only memory (module-level, resets on reload) is enough to kill the most
// noticeable repeats without needing to persist anything.
const lastShownIndex: Partial<Record<RevealMood, number>> = {};

export function pickFlavorLine(mood: RevealMood): string {
    const lines = FLAVOR_LINES[mood];

    if (lines.length === 1) {
        return lines[0]!;
    }

    let index = Math.floor(Math.random() * lines.length);

    while (index === lastShownIndex[mood]) {
        index = Math.floor(Math.random() * lines.length);
    }

    lastShownIndex[mood] = index;

    return lines[index]!;
}
