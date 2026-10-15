<script setup lang="ts">
// Desktop-panel rules recap for the Daily (DESKTOP_SPEC §3.2). Copy reuses
// the Daily 2.0 strings — no new rules text.
import { trackEvent } from '../utils/analytics';

defineProps<{ objective?: string | null }>();

function handleToggle(event: Event): void {
    trackEvent('daily_rules_toggle', { open: (event.target as HTMLDetailsElement).open });
}
</script>

<template>
    <details class="daily-rules" open @toggle="handleToggle">
        <summary class="daily-rules__summary">Today's rules</summary>
        <ul class="daily-rules__list">
            <li v-if="objective" class="daily-rules__objective">{{ objective }}</li>
            <li>Captain counts ×2 · name one before your last pick</li>
            <li>Bench −100 · once</li>
            <li>Reroll −50 · once</li>
            <li>Scouting clue −50 · once</li>
            <li>Points: win 800–1,000 · miss 275–700 · bust ≤ 250</li>
        </ul>
    </details>
</template>

<style lang="scss" scoped>
.daily-rules {
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    padding: 0 1rem;
}

.daily-rules__summary {
    align-items: center;
    cursor: pointer;
    display: flex;
    font-size: 0.88rem;
    font-weight: 700;
    min-height: var(--tap-min);
}

.daily-rules__list {
    color: var(--color-muted);
    display: flex;
    flex-direction: column;
    font-size: 0.8rem;
    gap: 0.35rem;
    margin: 0;
    padding: 0 0 1rem 1rem;
}

.daily-rules__objective {
    color: var(--color-foreground);
    font-weight: 700;
}
</style>
