<script setup lang="ts">
// The shared pitch-screen layout (DESKTOP_SPEC §3.2). Slot order equals
// today's phone order, and below 1024px every wrapper is `display: contents`
// so the page's own flex column lays the children out exactly as before.
// From 1024px: head / board / after in the left column, and a sticky,
// independently scrolling right panel (scoreboard … picker … result).
const props = defineProps<{
    /** The game just ended: scroll the panel (not the window) to its top. */
    over?: boolean;
}>();

const emit = defineEmits<{ rules: [] }>();

const panelEl = ref<HTMLElement | null>(null);

watch(() => props.over, (over, was) => {
    if (over && !was) {
        void nextTick(() => panelEl.value?.scrollTo?.({ top: 0 }));
    }
});
</script>

<template>
    <div class="game-layout">
        <div class="game-layout__head">
            <slot name="head" />
            <button class="game-layout__rules" type="button" @click="emit('rules')">
                <AppIcon name="info" />
                Rules
            </button>
        </div>
        <div ref="panelEl" class="game-layout__panel">
            <slot name="panel" />
        </div>
        <div class="game-layout__board">
            <slot name="board" />
        </div>
        <div class="game-layout__after">
            <slot name="after" />
        </div>
    </div>
</template>

<style lang="scss" scoped>
.game-layout,
.game-layout__head,
.game-layout__panel,
.game-layout__board,
.game-layout__after {
    display: contents;
}

// Desktop-only: the header's info button is hidden there (D6).
.game-layout__rules {
    display: none;
}

@media (width >= 1024px) {
    .game-layout {
        align-items: start;
        display: grid;
        gap: 1rem 2rem;
        grid-template:
            'head  panel' auto
            'board panel' auto
            'after panel' 1fr / minmax(0, 1fr) var(--panel-w);
        margin-inline: auto;
        max-width: calc(var(--board-max) + var(--panel-w) + 6rem);
        width: 100%;
    }

    .game-layout__head,
    .game-layout__after {
        align-items: stretch;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        min-width: 0;
    }

    .game-layout__head {
        grid-area: head;
    }

    .game-layout__after {
        grid-area: after;
    }

    .game-layout__board {
        display: block;
        grid-area: board;
        justify-self: center;
        width: 100%;
    }

    .game-layout__panel {
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        grid-area: panel;
        max-height: calc(100dvh - 2rem - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px));
        min-width: 0;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 0.25rem 0.25rem 1rem;
        position: sticky;
        top: calc(1rem + env(safe-area-inset-top, 0px));
    }

    .game-layout__rules {
        align-items: center;
        align-self: flex-start;
        background: none;
        border: 0;
        border-radius: var(--radius-sm);
        color: var(--color-primary);
        cursor: pointer;
        display: inline-flex;
        font: inherit;
        font-size: 0.85rem;
        font-weight: 700;
        gap: 0.35rem;
        margin: -0.5rem 0 0 -0.5rem;
        min-height: var(--tap-min);
        padding: 0 0.5rem;
    }
}

@media (width >= 1024px) and (hover: hover) and (pointer: fine) {
    .game-layout__rules:hover {
        background-color: var(--color-surface-2);
    }
}
</style>

<style lang="scss">
// The pitch itself, shared by every pitch page (replaces .play__board etc.).
.game-board {
    aspect-ratio: 2 / 3;
    container-type: inline-size;
    margin-top: 0.25rem;
    position: relative;
    width: 100%;
}

@media (width >= 1024px) {
    // Focus rings inside the panel's scroll container must not be clipped.
    .game-layout__panel :focus-visible {
        outline-offset: -2px;
    }

    .game-board {
        margin-inline: auto;
        margin-top: 0;
        min-width: 20rem;

        // Capped by the column, the token, and the viewport height (head ≈ 7rem).
        width: min(100%, var(--board-max), calc((100dvh - 9rem) * 2 / 3));
    }
}
</style>
