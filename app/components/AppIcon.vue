<script setup lang="ts">
// The handful of small decorative icons reused verbatim across the header
// controls on multiple pages — kept as one component with a `name` prop
// rather than three near-identical copies of the same markup drifting apart
// over time.
defineProps<{
    name: 'back' | 'calendar' | 'close' | 'info' | 'pitch' | 'stats' | 'target';
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

    <svg v-else-if="name === 'close'" aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
        <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
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

    <svg v-else-if="name === 'calendar'" aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
        <rect height="16" rx="2" stroke="currentColor" stroke-width="2" width="18" x="3" y="5" />
        <path d="M16 3v4M8 3v4M3 10h18" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
        <circle cx="8" cy="15" fill="currentColor" r="1.1" />
        <circle cx="12" cy="15" fill="currentColor" r="1.1" />
        <circle cx="16" cy="15" fill="currentColor" r="1.1" />
    </svg>

    <svg v-else-if="name === 'target'" aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
        <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="2" />
        <circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2" />
        <circle cx="12" cy="12" fill="currentColor" r="0.9" />
        <path d="M12 1v3M12 20v3M1 12h3M20 12h3" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
    </svg>

    <svg v-else-if="name === 'pitch'" aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20">
        <rect height="18" rx="1" stroke="currentColor" stroke-width="2" width="14" x="5" y="3" />
        <path d="M5 12h14" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
        <circle cx="12" cy="12" r="2.75" stroke="currentColor" stroke-width="2" />
    </svg>
</template>
