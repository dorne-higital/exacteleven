<script setup lang="ts">
usePageSeoMeta({
    title: 'How to play — Exact XI',
    description: 'The rules of Exact XI in plain language: formations, hidden stats, busts, the win window, rerolls and repeats.',
});
</script>

<template>
    <main class="how-to-play">
        <AppHeader>
            <NuxtLink class="how-to-play__back" to="/">
                <AppIcon name="back" />
                Home
            </NuxtLink>
        </AppHeader>

        <div class="how-to-play__inner">
            <h1>How to play</h1>

            <HowToPlayContent />
        </div>
    </main>
</template>

<style lang="scss" scoped>
// AppHeader is a direct child here (not nested inside .how-to-play__inner)
// so it's sized by its own max-width, not this page's — see AppHeader.vue
// for why that matters.
.how-to-play {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    min-height: 100vh;
    padding: 1.5rem 1.25rem;
}

.how-to-play__inner {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    max-width: 34rem;
    width: 100%;
}

.how-to-play__back {
    align-items: center;
    color: inherit;
    display: flex;
    font-size: 0.85rem;
    font-weight: 600;
    gap: 0.4rem;
    text-decoration: none;
}

.how-to-play__back:hover,
.how-to-play__back:focus-visible {
    color: var(--color-primary);
}

h1 {
    margin: 0;
}
</style>
