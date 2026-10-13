<script setup lang="ts">
// Shared shell for any "small content panel over the current page" modal —
// centered, not a bottom sheet, since these are content-heavy reads rather
// than action sheets. Built on the same native <dialog> pattern as
// PlayerChoiceDialog: showModal() for the focus trap, native Escape/backdrop
// handling, closing via @close rather than duplicating that logic. Used by
// InfoDialog and StatsDialog.
defineProps<{
    title: string;
}>();

const open = defineModel<boolean>('open', { default: false });

const dialogRef = ref<HTMLDialogElement | null>(null);
const titleId = useId();

watch(open, (isOpen) => {
    if (isOpen) {
        dialogRef.value?.showModal();
    } else {
        dialogRef.value?.close();
    }
});

function handleNativeClose(): void {
    open.value = false;
}

// A click that lands on the <dialog> element itself (not a descendant) means
// it hit the backdrop area, not the content — the native way to detect a
// click-outside on a <dialog>.
function handleBackdropClick(event: MouseEvent): void {
    if (event.target === dialogRef.value) {
        open.value = false;
    }
}
</script>

<template>
    <dialog ref="dialogRef" :aria-labelledby="titleId" class="centered-dialog" @click="handleBackdropClick" @close="handleNativeClose">
        <div class="centered-dialog__header">
            <h2 :id="titleId" class="centered-dialog__title">{{ title }}</h2>
            <button aria-label="Close" class="centered-dialog__close" type="button" @click="open = false">
                <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
                    <path
                        d="M6 6l12 12M18 6 6 18"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-width="2"
                    />
                </svg>
            </button>
        </div>

        <div class="centered-dialog__body">
            <slot />
        </div>
    </dialog>
</template>

<style lang="scss" scoped>
// Bib & Board: a flat surface card with a 1px hairline and an 18px radius;
// the only real shadow in the system, since it genuinely floats.
.centered-dialog {
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    box-sizing: border-box;
    color: var(--color-foreground);
    margin: auto;

    // dvh (with a vh fallback) so mobile browser chrome sliding in and out
    // doesn't push the bottom of the dialog off-screen. The safe-area insets
    // keep it clear of the notch / home bar in the iOS app.
    max-height: calc(85vh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    max-height: calc(85dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    max-width: 28rem;
    padding: 0;
    transition: opacity 0.2s ease, overlay 0.2s ease allow-discrete, display 0.2s ease allow-discrete;
    width: calc(100% - 2rem);
}

// Header pinned, body scrolls — so the title and close button stay in
// reach however far down a long read (How to play, Stats) someone gets.
.centered-dialog[open] {
    display: flex;
    flex-direction: column;
}

@starting-style {
    .centered-dialog[open] {
        opacity: 0;
    }
}

@media (prefers-reduced-motion: reduce) {
    .centered-dialog {
        transition: none;
    }
}

.centered-dialog::backdrop {
    background-color: color-mix(in srgb, var(--color-primary-strong) 60%, transparent);
    transition: overlay 0.2s ease allow-discrete, display 0.2s ease allow-discrete, opacity 0.2s ease;
}

.centered-dialog[open]::backdrop {
    opacity: 1;
}

@starting-style {
    .centered-dialog[open]::backdrop {
        opacity: 0;
    }
}

@media (prefers-reduced-motion: reduce) {
    .centered-dialog::backdrop {
        transition: none;
    }
}

.centered-dialog__header {
    align-items: center;
    border-bottom: 1px solid var(--color-line);
    display: flex;
    flex-shrink: 0;
    gap: 0.75rem;
    justify-content: space-between;
    padding: 0.75rem 0.75rem 0.75rem 1.25rem;
}

.centered-dialog__body {
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 1.25rem;
}

@media (width >= 30rem) {
    .centered-dialog__header {
        padding: 0.875rem 0.875rem 0.875rem 1.5rem;
    }

    .centered-dialog__body {
        padding: 1.25rem 1.5rem 1.5rem;
    }
}

.centered-dialog__title {
    font-size: 1.75rem;
    font-weight: 900;
    margin: 0;
}

.centered-dialog__close {
    align-items: center;
    background-color: var(--color-surface-2);
    border: 1px solid transparent;
    border-radius: var(--radius-pill);
    color: var(--color-foreground);
    cursor: pointer;
    display: flex;
    flex-shrink: 0;
    height: var(--tap-min);
    justify-content: center;
    padding: 0;
    width: var(--tap-min);
}

.centered-dialog__close:hover,
.centered-dialog__close:focus-visible {
    border-color: var(--color-primary);
    color: var(--color-primary);
}
</style>
