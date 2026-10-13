<script setup lang="ts">
usePageSeoMeta({
    title: 'How to play — Exact XI',
    description: 'The rules of Exact XI in plain language: formations, hidden stats, busts, the win window, rerolls and repeats.',
});
</script>

<template>
    <main class="how-to-play">
        <AppHeader>
            <NuxtLink class="app-header-back how-to-play__back" to="/">
                <AppIcon name="back" />
                Home
            </NuxtLink>
        </AppHeader>

        <div class="how-to-play__inner">
            <h1>How to play</h1>

            <div class="how-to-play__card">
                <HowToPlayContent />
            </div>
        </div>
    </main>
</template>

<style lang="scss" scoped>
// Bib & Board reading page: the rules sit on one surface card so the page
// matches the InfoDialog version of the same content. AppHeader is a direct
// child here (not nested inside .how-to-play__inner) so it's sized by its
// own max-width, not this page's — see AppHeader.vue for why that matters.
.how-to-play {
    box-sizing: border-box;
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1rem 1rem 5.5rem;
}

.how-to-play__inner {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin: 0 auto;
    max-width: 36rem;
    width: 100%;
}

// The back pill's look comes from AppHeader (.app-header-back).
.how-to-play__back {
    margin-right: auto;
}

h1 {
    margin: 0;
}

.how-to-play__card {
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-sm);
    padding: 1.25rem;
}

@media (width >= 30rem) {
    .how-to-play__card {
        padding: 1.5rem;
    }
}
</style>
