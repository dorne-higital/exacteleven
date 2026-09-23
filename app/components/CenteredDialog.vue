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
</script>

<template>
    <dialog ref="dialogRef" :aria-labelledby="titleId" class="centered-dialog" @close="handleNativeClose">
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

        <slot />
    </dialog>
</template>

<style lang="scss" scoped>
.centered-dialog {
    background-color: var(--color-surface);
    border: 1px solid color-mix(in srgb, var(--color-foreground) 15%, transparent);
    border-radius: 1rem;
    box-shadow: 0 16px 40px rgb(0 0 0 / 25%);
    color: inherit;
    margin: auto;
    max-height: 80vh;
    max-width: 26rem;
    overflow-y: auto;
    padding: 1.25rem 1.5rem;
    transition: opacity 0.2s ease, overlay 0.2s ease allow-discrete, display 0.2s ease allow-discrete;
    width: calc(100% - 3rem);
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
    background-color: color-mix(in srgb, var(--color-primary-strong) 55%, transparent);
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
    display: flex;
    justify-content: space-between;
    margin-bottom: 0.9rem;
}

.centered-dialog__title {
    margin: 0;
}

.centered-dialog__close {
    align-items: center;
    background-color: color-mix(in srgb, var(--color-foreground) 6%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-foreground) 15%, transparent);
    border-radius: 50%;
    color: inherit;
    cursor: pointer;
    display: flex;
    height: 2.75rem;
    justify-content: center;
    width: 2.75rem;
}

.centered-dialog__close:hover,
.centered-dialog__close:focus-visible {
    border-color: var(--color-primary);
}
</style>
