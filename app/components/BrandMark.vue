<script setup lang="ts">
// The Exact XI mark, swapped with the colour scheme (system setting,
// overridable by data-theme on <html>, the same rules as app.vue's tokens).
// Used by AppHeader and the desktop rail.
withDefaults(defineProps<{ size?: number }>(), { size: 28 });
</script>

<template>
    <span class="brand-mark">
        <img alt="" class="brand-mark__img brand-mark__img--light" :height="size" src="/logo/exact-xi-mark-on-light.svg" :width="size">
        <img alt="" class="brand-mark__img brand-mark__img--dark" :height="size" src="/logo/exact-xi-mark-on-dark.svg" :width="size">
    </span>
</template>

<style lang="scss" scoped>
.brand-mark {
    display: inline-flex;
    flex-shrink: 0;
}

.brand-mark__img {
    display: block;
}

.brand-mark__img--dark {
    display: none;
}

@media (prefers-color-scheme: dark) {
    :root:not([data-theme='light']) .brand-mark__img--light {
        display: none;
    }

    :root:not([data-theme='light']) .brand-mark__img--dark {
        display: block;
    }
}

:root[data-theme='dark'] .brand-mark__img--light {
    display: none;
}

:root[data-theme='dark'] .brand-mark__img--dark {
    display: block;
}
</style>
