<script setup lang="ts">
// Persistent across every page: the logo + wordmark always link home, and
// each page puts its own controls (a back link, the info button) in the
// slot — see index.vue/play.vue/how-to-play.vue for what each page passes.
// Sized to its own max-width (not its parent's) so the bar renders the same
// width on every page, regardless of how wide that page's own content
// column happens to be below it.
//
// Slot controls can opt into the shared Bib & Board header look with these
// classes (styled in this file's unscoped block so every page matches):
//   .app-header-button        a 44px square icon button
//   .app-header-back          a 44px-tall "‹ Home" style back pill
// The page's own click handler / trackEvent() stays on the element.
//
// The Settings gear is built in (web and app), after the page's own
// controls, on every page except Settings itself.
import { trackEvent } from '../utils/analytics';

const route = useRoute();
const onSettings = computed(() => route.path === '/settings');

function openSettings(): void {
    trackEvent('view_settings', { source: String(route.name ?? route.path) });
}
</script>

<template>
    <header class="app-header">
        <NuxtLink aria-label="Exact XI home" class="app-header__brand" to="/">
            <img alt="" class="app-header__mark app-header__mark--light" height="28" src="/logo/exact-xi-mark-on-light.svg" width="28">
            <img alt="" class="app-header__mark app-header__mark--dark" height="28" src="/logo/exact-xi-mark-on-dark.svg" width="28">
            <span class="app-header__name">Exact XI</span>
        </NuxtLink>

        <div class="app-header__actions">
            <slot />
            <NuxtLink v-if="!onSettings" aria-label="Settings" class="app-header-button" to="/settings" @click="openSettings">
                <AppIcon name="gear" />
            </NuxtLink>
        </div>
    </header>
</template>

<style lang="scss" scoped>
.app-header {
    align-items: center;
    box-sizing: border-box;
    display: flex;
    gap: 0.75rem;
    justify-content: space-between;
    margin: 0 auto;
    max-width: 36rem;
    min-height: var(--tap-min);
    width: 100%;
}

.app-header__brand {
    align-items: center;
    border-radius: var(--radius-sm);
    color: var(--color-foreground);
    display: flex;
    gap: 0.5rem;
    min-height: var(--tap-min);
    text-decoration: none;
}

.app-header__mark {
    display: block;
}

// The mark swaps with the colour scheme: the same rules as app.vue's token
// switch (system setting, overridable by data-theme on <html>).
.app-header__mark--dark {
    display: none;
}

@media (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) .app-header__mark--light {
        display: none;
    }

    :root:not([data-theme='light']) .app-header__mark--dark {
        display: block;
    }
}

:root[data-theme='dark'] .app-header__mark--light {
    display: none;
}

:root[data-theme='dark'] .app-header__mark--dark {
    display: block;
}

.app-header__name {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 900;
    letter-spacing: 0.02em;
    line-height: 1;
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

<style lang="scss">
// Unscoped on purpose: these style controls that pages pass into the slot
// (scoped styles can't reach slot content without :slotted, which this
// project's stylelint setup doesn't know).
.app-header-button,
.app-header-back {
    align-items: center;
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm);
    box-sizing: border-box;
    color: var(--color-foreground);
    cursor: pointer;
    display: inline-flex;
    font: inherit;
    justify-content: center;
    min-height: var(--tap-min);
    text-decoration: none;
    transition: border-color 0.15s ease, color 0.15s ease;
}

.app-header-button {
    padding: 0;
    width: var(--tap-min);
}

.app-header-back {
    font-size: 0.875rem;
    font-weight: 600;
    gap: 0.35rem;
    padding: 0 0.9rem 0 0.7rem;
}

.app-header-button:hover,
.app-header-back:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
}

@media (prefers-reduced-motion: reduce) {
    .app-header-button,
    .app-header-back {
        transition: none;
    }
}
</style>
