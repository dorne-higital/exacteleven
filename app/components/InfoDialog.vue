<script setup lang="ts">
const open = defineModel<boolean>('open', { default: false });
</script>

<template>
    <CenteredDialog v-model:open="open" title="How to play">
        <HowToPlayContent />
    </CenteredDialog>
</template>
