<script setup lang="ts">
// Persistent across every page: the logo + wordmark always link home, and
// each page puts its own controls (a back link, the info button) in the
// slot — see index.vue/play.vue/how-to-play.vue for what each page passes.
// Sized to its own max-width (not its parent's) so the bar renders the same
// width on every page, regardless of how wide that page's own content
// column happens to be below it.
</script>

<template>
    <header class="app-header">
        <NuxtLink aria-label="Exact XI home" class="app-header__brand" to="/">
            <img alt="" class="app-header__mark" height="26" src="/logo/exact-xi-mark-on-light.svg" width="26">
            <span class="app-header__name">Exact XI</span>
        </NuxtLink>

        <div class="app-header__actions">
            <slot />
        </div>
    </header>
</template>

<style lang="scss" scoped>
.app-header {
    align-items: center;
    display: flex;
    justify-content: space-between;
    margin: 0 auto;
    max-width: 36rem;
    width: 100%;
}

.app-header__brand {
    align-items: center;
    color: inherit;
    display: flex;
    gap: 0.5rem;
    text-decoration: none;
}

.app-header__mark {
    display: block;
}

.app-header__name {
    font-family: var(--font-display);
    font-size: 1.1rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    text-transform: var(--display-text-transform);
}

// flex: 1 + justify-content: flex-end (rather than relying on space-between
// alone) so this stays right-aligned as a block regardless of what's in the
// slot — e.g. play.vue's back link uses margin-right: auto to split itself
// off to the left of the icon buttons, but the icon buttons must still hug
// the right edge on their own when that back link isn't rendered at all
// (game-over state).
.app-header__actions {
    align-items: center;
    display: flex;
    flex: 1;
    gap: 0.5rem;
    justify-content: flex-end;
}
</style>
