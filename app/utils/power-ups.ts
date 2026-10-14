// What the pick sheet's Reroll / Hint buttons say and do, from useGame's
// canReroll / canHint state (see PowerUpState there). Pure, so the copy and
// the rules are unit-tested without mounting the dialog.
//
// - 'free'  the game's own free one:      "Reroll · 1 left"
// - 'boost' spends one banked boost:      "Reroll · use a boost (N)"
// - 'pro'   a Pro extra:                  "Reroll · Pro"
// - 'shop'  none left, the shop sells more: "Get boosts" (opens the shop)
// - 'none'  nothing available: disabled, as before ("Reroll · 0 left", or
//           "Hint (locked)" when HINT_MIN_OPEN_SLOTS blocks a hint)
import type { GameMode, PowerUpReason } from '../composables/useGame';

export type PowerUpKind = 'reroll' | 'hint';

export interface PowerUpInput {
    reason: PowerUpReason;
    freeLeft: number;
    locked?: boolean;
}

export interface PowerUpButton {
    label: string;
    /** 'use' spends (free/pro/boost), 'shop' opens the shop, 'none' is disabled. */
    action: 'use' | 'shop' | 'none';
}

const NAMES: Record<PowerUpKind, string> = { reroll: 'Reroll', hint: 'Hint' };

export function powerUpButton(kind: PowerUpKind, state: PowerUpInput, boostBank: number): PowerUpButton {
    const name = NAMES[kind];

    switch (state.reason) {
        case 'free':
            return { label: `${name} · ${state.freeLeft} left`, action: 'use' };
        case 'boost':
            return { label: `${name} · use a boost (${boostBank})`, action: 'use' };
        case 'pro':
            return { label: `${name} · Pro`, action: 'use' };
        case 'shop':
            return { label: 'Get boosts', action: 'shop' };
        default:
            return { label: state.locked ? `${name} (locked)` : `${name} · ${state.freeLeft} left`, action: 'none' };
    }
}

// The short line under the buttons explaining a disabled one, or null.
// In the app, a spent reroll/hint in the Daily is the one case a player
// might expect boosts to work; the website has no boosts, so it never says so.
export function powerUpNote(mode: GameMode | null, isApp: boolean, reroll: PowerUpInput, hint: PowerUpInput): string | null {
    if (!isApp || mode !== 'daily') {
        return null;
    }

    const spent = (state: PowerUpInput) => state.reason === 'none' && !state.locked;

    return spent(reroll) || spent(hint) ? 'Daily: one free reroll and hint each. Boosts can\'t be used here.' : null;
}
