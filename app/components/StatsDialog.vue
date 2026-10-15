<script setup lang="ts">
// The stats modal (header buttons on phone and tablet). Its body is
// StatsContent, which the /stats page renders too.
const open = defineModel<boolean>('open', { default: false });
</script>

<template>
    <CenteredDialog v-model:open="open" title="Your stats">
        <StatsContent layout="dialog" />
    </CenteredDialog>
</template>
