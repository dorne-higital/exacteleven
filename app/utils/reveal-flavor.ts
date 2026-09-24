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
    ],
    win: [
        'Nailed it. On the nose.',
        'Precision finishing.',
        "That's exactly what we needed.",
        'Perfect landing.',
        'Right on target.',
    ],
    close: [
        "That's cutting it fine.",
        'Living dangerously.',
        'One more like that and it\'s over.',
        'Tightrope stuff.',
        'No room left to breathe.',
    ],
};

export function pickFlavorLine(mood: RevealMood): string {
    const lines = FLAVOR_LINES[mood];

    return lines[Math.floor(Math.random() * lines.length)]!;
}
