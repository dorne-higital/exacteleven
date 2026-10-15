import { describe, expect, it } from 'vitest';
import type { PickerKeyContext } from '../app/utils/picker-keys';
import { pickerKeyAction } from '../app/utils/picker-keys';

const key = (k: string, mods: Partial<Record<'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'isComposing', boolean>> = {}) => ({
    key: k, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, isComposing: false, ...mods,
});
const ctx = (over: Partial<PickerKeyContext> = {}): PickerKeyContext => ({
    targetIsEditable: false, otherModalOpen: false, busy: false, showingResult: false,
    optionCount: 3, isDaily: false, rerollAction: 'use', inline: true, ...over,
});

describe('pickerKeyAction', () => {
    it('picks 1/2/3 within the option count', () => {
        expect(pickerKeyAction(key('1'), ctx())).toEqual({ type: 'pick', index: 0 });
        expect(pickerKeyAction(key('3'), ctx())).toEqual({ type: 'pick', index: 2 });
        expect(pickerKeyAction(key('3'), ctx({ optionCount: 2 }))).toBeNull();
        expect(pickerKeyAction(key('4'), ctx())).toBeNull();
    });

    it('does nothing while busy, showing a result, editing, under another modal or with a modifier', () => {
        expect(pickerKeyAction(key('1'), ctx({ busy: true }))).toBeNull();
        expect(pickerKeyAction(key('1'), ctx({ showingResult: true }))).toBeNull();
        expect(pickerKeyAction(key('1'), ctx({ targetIsEditable: true }))).toBeNull();
        expect(pickerKeyAction(key('r'), ctx({ otherModalOpen: true }))).toBeNull();

        for (const mod of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey', 'isComposing'] as const) {
            expect(pickerKeyAction(key('1', { [mod]: true }), ctx())).toBeNull();
        }
    });

    it('R rerolls in Classic only when the action is "use" (never the shop)', () => {
        expect(pickerKeyAction(key('r'), ctx())).toEqual({ type: 'reroll' });
        expect(pickerKeyAction(key('R'), ctx())).toEqual({ type: 'reroll' });
        expect(pickerKeyAction(key('r'), ctx({ rerollAction: 'shop' }))).toBeNull();
        expect(pickerKeyAction(key('r'), ctx({ rerollAction: 'none' }))).toBeNull();
        expect(pickerKeyAction(key('r'), ctx({ busy: true }))).toBeNull();
    });

    it('R only focuses the reroll button in the Daily', () => {
        expect(pickerKeyAction(key('r'), ctx({ isDaily: true }))).toEqual({ type: 'reroll_focus' });
        expect(pickerKeyAction(key('r'), ctx({ isDaily: true, rerollAction: 'none' }))).toEqual({ type: 'reroll_focus' });
    });

    it('Escape closes only the inline picker', () => {
        expect(pickerKeyAction(key('Escape'), ctx())).toEqual({ type: 'close' });
        expect(pickerKeyAction(key('Escape'), ctx({ inline: false }))).toBeNull();
        expect(pickerKeyAction(key('h'), ctx())).toBeNull();
    });
});
