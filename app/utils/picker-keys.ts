// Keyboard shortcuts for the player picker (DESKTOP_SPEC §4), as a pure
// function so the rules are testable: 1/2/3 pick, R rerolls (Classic /
// Challenge) or only FOCUSES "Reroll −50" (Daily — points are never spent
// by a stray key), Escape closes the inline (non-modal) picker. Nothing else.

export type PickerKeyAction =
    | { type: 'pick'; index: 0 | 1 | 2 }
    | { type: 'reroll' }
    | { type: 'reroll_focus' }
    | { type: 'close' }
    | null;

export type PickerKeyEvent = Pick<KeyboardEvent, 'key' | 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'isComposing'>;

export interface PickerKeyContext {
    /** The key landed in an input, textarea, select or [contenteditable]. */
    targetIsEditable: boolean;
    /** A modal dialog other than the picker is open (captain/bench sheet, stats, shop). */
    otherModalOpen: boolean;
    /** revealing || isScrambling || isDrawing || daily.busy */
    busy: boolean;
    showingResult: boolean;
    optionCount: number;
    isDaily: boolean;
    /** Classic: powerUpButton().action. Daily: available ? 'use' : 'none'. */
    rerollAction: 'use' | 'shop' | 'none';
    inline: boolean;
}

const PICK_KEYS: Record<string, 0 | 1 | 2> = { 1: 0, 2: 1, 3: 2 };

export function pickerKeyAction(event: PickerKeyEvent, ctx: PickerKeyContext): PickerKeyAction {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) {
        return null;
    }

    if (ctx.targetIsEditable || ctx.otherModalOpen) {
        return null;
    }

    const index = PICK_KEYS[event.key];

    if (index !== undefined) {
        return !ctx.busy && !ctx.showingResult && index < ctx.optionCount ? { type: 'pick', index } : null;
    }

    if (event.key === 'r' || event.key === 'R') {
        if (ctx.busy || ctx.showingResult) {
            return null;
        }

        if (ctx.isDaily) {
            return { type: 'reroll_focus' };
        }

        return ctx.rerollAction === 'use' ? { type: 'reroll' } : null;
    }

    if (event.key === 'Escape') {
        return ctx.inline ? { type: 'close' } : null;
    }

    return null;
}

/** The analytics `key` param for a handled key. */
export function shortcutKeyName(key: string): string {
    return key === 'Escape' ? 'escape' : key.toLowerCase();
}

export function isEditableTarget(target: EventTarget | null): boolean {
    if (!target || typeof (target as HTMLElement).closest !== 'function') {
        return false;
    }

    return !!(target as HTMLElement).closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
}
