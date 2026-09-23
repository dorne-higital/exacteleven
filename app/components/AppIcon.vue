<script setup lang="ts">
// The handful of small decorative icons reused verbatim across the header
// controls on multiple pages — kept as one component with a `name` prop
// rather than three near-identical copies of the same markup drifting apart
// over time.
defineProps<{
    name: 'back' | 'info' | 'stats';
}>();
</script>

<template>
    <svg v-if="name === 'back'" aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
        <path
            d="M19 12H5m0 0 7 7m-7-7 7-7"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
        />
    </svg>

    <svg v-else-if="name === 'info'" aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
        <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
        <path d="M12 11v5.5" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
        <circle cx="12" cy="7.75" fill="currentColor" r="1.15" />
    </svg>

    <svg v-else-if="name === 'stats'" aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
        <rect height="8" rx="1" stroke="currentColor" stroke-width="2" width="4" x="4" y="12" />
        <rect height="12" rx="1" stroke="currentColor" stroke-width="2" width="4" x="10" y="8" />
        <rect height="16" rx="1" stroke="currentColor" stroke-width="2" width="4" x="16" y="4" />
    </svg>
</template>
