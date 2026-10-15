<script setup lang="ts">
// The one shell every page (and every future mode) renders inside. Below
// 1024px it is a plain pass-through column, so phones and tablets lay out
// exactly as before. From 1024px it becomes a two-column grid with the
// DesktopRail on the left. The rail is always server-rendered and shown by
// a media query (no hydration flash); a page opts out with
// definePageMeta({ rail: false }).
import DesktopRail from './DesktopRail.vue';

const route = useRoute();
const railEnabled = computed(() => route.meta.rail !== false);

const { init } = useViewport();

onMounted(() => {
    init();
});
</script>

<template>
    <div class="shell" :class="{ 'shell--rail': railEnabled }">
        <DesktopRail v-if="railEnabled" />
        <div class="shell__main">
            <slot />
        </div>
    </div>
</template>

<style lang="scss" scoped>
.shell,
.shell__main {
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
    min-width: 0;
}

@media (width >= 1024px) {
    .shell--rail {
        display: grid;
        grid-template-columns: var(--rail-w) minmax(0, 1fr);
    }
}
</style>
