<script setup lang="ts">
// Persistent across every page: the logo always links home, and each page
// puts its own controls (a back link, the info button, ThemeToggle) in the
// slot — see index.vue/play.vue/how-to-play.vue for what each page passes.
</script>

<template>
    <header class="app-header">
        <NuxtLink aria-label="Exact XI home" class="app-header__logo" to="/">
            <img alt="" height="26" src="/logo/exact-xi-mark-on-light.svg" width="26">
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
    width: 100%;
}

.app-header__logo {
    display: block;
    line-height: 0;
}

.app-header__actions {
    align-items: center;
    display: flex;
    gap: 0.5rem;
}
</style>
