<script setup lang="ts">
// A thumb-reach action sheet: the same native <dialog> pattern and slide-up
// look as PlayerChoiceDialog (showModal() focus trap, Escape and backdrop
// close via @close), for the Daily's short decisions — naming a captain,
// bringing on the bench. Centred and width-capped above phone width.
defineProps<{
    title: string;
    eyebrow?: string;
}>();

const open = defineModel<boolean>('open', { default: false });

const dialogRef = ref<HTMLDialogElement | null>(null);
const titleId = useId();

function sync(isOpen: boolean): void {
    const dialog = dialogRef.value;

    if (!dialog) {
        return;
    }

    if (isOpen && !dialog.open) {
        dialog.showModal();
    } else if (!isOpen && dialog.open) {
        dialog.close();
    }
}

watch(open, sync);

onMounted(() => {
    sync(open.value);
});

function handleNativeClose(): void {
    open.value = false;
}

function handleBackdropClick(event: MouseEvent): void {
    if (event.target === dialogRef.value) {
        open.value = false;
    }
}
</script>

<template>
    <dialog ref="dialogRef" :aria-labelledby="titleId" class="bottom-sheet" @click="handleBackdropClick" @close="handleNativeClose">
        <div aria-hidden="true" class="bottom-sheet__handle" />
        <h2 :id="titleId" class="bottom-sheet__title">
            <span v-if="eyebrow" class="bottom-sheet__eyebrow">{{ eyebrow }}</span>
            <span class="bottom-sheet__heading">{{ title }}</span>
        </h2>
        <slot />
    </dialog>
</template>

<style lang="scss" scoped>
.bottom-sheet {
    background-color: var(--color-background);
    border: 1px solid var(--color-line);
    border-bottom: 0;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow: var(--shadow-lg);
    box-sizing: border-box;
    color: var(--color-foreground);
    inset: auto 0 0;
    margin: 0;
    max-height: 85vh;
    max-height: 85dvh;
    max-width: 100%;
    overflow-y: auto;
    padding: 0.6rem calc(1rem + env(safe-area-inset-right, 0px)) calc(1.25rem + env(safe-area-inset-bottom, 0px)) calc(1rem + env(safe-area-inset-left, 0px));
    position: fixed;
    transform: translateY(0);
    transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), overlay 0.28s ease allow-discrete, display 0.28s ease allow-discrete;
    width: 100%;
}

@starting-style {
    .bottom-sheet[open] {
        transform: translateY(100%);
    }
}

@media (width >= 640px) {
    .bottom-sheet {
        border-bottom: 1px solid var(--color-line);
        border-radius: var(--radius-lg);
        bottom: 2rem;
        left: 50%;
        max-width: 26rem;
        padding: 1.25rem;
        right: auto;
        transform: translateX(-50%) translateY(0);
        width: calc(100% - 4rem);
    }

    @starting-style {
        .bottom-sheet[open] {
            transform: translateX(-50%) translateY(120%);
        }
    }
}

// Desktop / iPad (>= 1024px): a centred modal, not bottom-anchored. Entry is
// a fade plus an 8px rise instead of the slide-up.
@media (width >= 1024px) {
    .bottom-sheet {
        bottom: auto;
        max-height: calc(85dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
        opacity: 1;
        top: 50%;
        transform: translate(-50%, -50%);
        transition: transform 0.2s ease, opacity 0.2s ease, overlay 0.2s ease allow-discrete, display 0.2s ease allow-discrete;
    }

    @starting-style {
        .bottom-sheet[open] {
            opacity: 0;
            transform: translate(-50%, calc(-50% + 8px));
        }
    }
}

.bottom-sheet::backdrop {
    background-color: color-mix(in srgb, var(--color-primary-strong) 55%, transparent);
}

@media (prefers-reduced-motion: reduce) {
    .bottom-sheet {
        transition: none;
    }
}

.bottom-sheet__handle {
    background-color: var(--color-line);
    border-radius: var(--radius-pill);
    height: 0.3rem;
    margin: 0 auto 0.75rem;
    width: 2.5rem;
}

@media (width >= 640px) {
    .bottom-sheet__handle {
        display: none;
    }
}

.bottom-sheet__title {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    margin: 0 0 0.5rem;
}

.bottom-sheet__eyebrow {
    color: var(--color-muted);
    font-family: var(--font-body);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}

.bottom-sheet__heading {
    font-size: 1.75rem;
    font-weight: 900;
    line-height: 1;
}
</style>
