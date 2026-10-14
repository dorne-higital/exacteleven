<script setup lang="ts">
// The handful of small decorative icons reused verbatim across the header
// controls on multiple pages — kept as one component with a `name` prop
// rather than three near-identical copies of the same markup drifting apart
// over time. Line icons at a 2px stroke, drawn in currentColor so they take
// whatever token their parent sets.
defineProps<{
    name: 'back' | 'bolt' | 'calendar' | 'check' | 'chevron' | 'close' | 'flame' | 'forward' | 'gear' | 'info' | 'lock' | 'pitch' | 'stats' | 'target' | 'trophy';
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

    <svg v-else-if="name === 'forward'" aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
        <path
            d="M5 12h14m0 0-7-7m7 7-7 7"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
        />
    </svg>

    <svg v-else-if="name === 'chevron'" aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
        <path d="m9 6 6 6-6 6" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" />
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

    <svg v-else-if="name === 'gear'" aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" />
        <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
        />
    </svg>

    <svg v-else-if="name === 'lock'" aria-hidden="true" fill="none" height="14" viewBox="0 0 24 24" width="14">
        <rect height="10" rx="2" stroke="currentColor" stroke-width="2" width="16" x="4" y="11" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" stroke-linecap="round" stroke-width="2" />
    </svg>

    <svg v-else-if="name === 'check'" aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
        <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.4" />
    </svg>

    <svg v-else-if="name === 'bolt'" aria-hidden="true" fill="none" height="16" viewBox="0 0 24 24" width="16">
        <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" stroke="currentColor" stroke-linejoin="round" stroke-width="2" />
    </svg>

    <svg v-else-if="name === 'trophy'" aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
        <path
            d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
        />
    </svg>

    <svg v-else-if="name === 'flame'" aria-hidden="true" fill="none" height="14" viewBox="0 0 24 24" width="14">
        <path
            d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
        />
    </svg>
</template>
