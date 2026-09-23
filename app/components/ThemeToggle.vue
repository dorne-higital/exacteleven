<script setup lang="ts">
const { theme, setTheme } = useTheme();

const isDugoutDark = computed(() => theme.value === 'dugout-dark');
const label = computed(() => (isDugoutDark.value ? 'Switch to Match Programme theme' : 'Switch to Dugout Dark theme'));

function toggle(): void {
    setTheme(isDugoutDark.value ? 'match-programme' : 'dugout-dark');
}
</script>

<template>
    <button :aria-label="label" class="theme-toggle" type="button" @click="toggle">
        <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
            <path
                d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
            />
        </svg>
    </button>
</template>

<style lang="scss" scoped>
.theme-toggle {
    align-items: center;
    background-color: color-mix(in srgb, var(--color-foreground) 6%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-foreground) 15%, transparent);
    border-radius: 50%;
    color: inherit;
    cursor: pointer;
    display: flex;
    height: 2.25rem;
    justify-content: center;
    padding: 0;
    width: 2.25rem;
}

.theme-toggle:hover,
.theme-toggle:focus-visible {
    border-color: var(--color-primary);
}
</style>
