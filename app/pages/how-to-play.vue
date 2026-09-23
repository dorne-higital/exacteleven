<script setup lang="ts">
useSeoMeta({
    title: 'How to play — Exact XI',
    description: 'The rules of Exact XI in plain language: formations, hidden stats, busts, the win window, rerolls and repeats.',
});
</script>

<template>
    <main class="how-to-play">
        <div class="how-to-play__inner">
            <AppHeader>
                <NuxtLink class="how-to-play__back" to="/">
                    <svg aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
                        <path
                            d="M19 12H5m0 0 7 7m-7-7 7-7"
                            stroke="currentColor"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                        />
                    </svg>
                    Home
                </NuxtLink>
                <ThemeToggle />
            </AppHeader>

            <h1>How to play</h1>

            <HowToPlayContent />
        </div>
    </main>
</template>

<style lang="scss" scoped>
.how-to-play {
    display: flex;
    justify-content: center;
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
