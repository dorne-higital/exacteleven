<script setup lang="ts">
import type { DailyArchiveItem } from '../../shared/daily2-types';
import { trackEvent } from '../utils/analytics';
import { archiveRowText } from '../utils/daily-screens';
import { isAppBuild } from '../utils/platform';

// The Daily archive (DAILY2_SPEC §6.9): replay any past Daily since launch.
// A Pro perk in the app; archive games are unranked and never touch your
// streak, stats or the table. Without Pro (or on the website) it's a locked
// teaser that opens the Shop in the app.
const { archiveAvailable, archiveList, archiveNextBefore, loadArchiveList, loadError } = useDaily();
const { openShop } = useShop();
const isApp = isAppBuild();

const loading = ref(false);
const loaded = ref(false);

async function loadMore(before?: string): Promise<void> {
    if (loading.value) {
        return;
    }

    loading.value = true;
    loadError.value = null;

    try {
        await loadArchiveList(before);
        loaded.value = true;
    } finally {
        loading.value = false;
    }
}

onMounted(() => {
    trackEvent('view_archive', { source: 'archive_page', locked: !archiveAvailable.value });

    if (archiveAvailable.value) {
        void loadMore();
    }
});

function handleMore(): void {
    if (archiveNextBefore.value) {
        trackEvent('archive_more', { before: archiveNextBefore.value });
        void loadMore(archiveNextBefore.value);
    }
}

function handleUnlock(): void {
    trackEvent('archive_locked', { source: 'archive_page' });
    openShop('archive');
}

function handleRow(item: DailyArchiveItem): void {
    trackEvent('archive_select', { date: item.date, kind: item.objective.kind, stat: item.objective.stat });
}

usePageSeoMeta({
    title: 'Daily archive — Exact XI',
    description: 'Replay every past Exact XI Daily with Pro in the app. Archive games never touch your streak or the table.',
});
</script>

<template>
    <main class="archive">
        <AppHeader>
            <NuxtLink class="app-header-back" to="/daily">
                <AppIcon name="back" />
                Daily
            </NuxtLink>
        </AppHeader>

        <div class="archive__inner">
            <h1 class="archive__title">Daily archive</h1>
            <p class="archive__lede">Every past Daily, same options as on the day. Replays don't touch your streak or the table.</p>

            <section v-if="!archiveAvailable" class="archive__locked">
                <AppIcon class="archive__lock" name="lock" />
                <p class="archive__locked-title">Replay every past Daily with Pro.</p>
                <button v-if="isApp" class="archive__unlock" type="button" @click="handleUnlock">See Pro</button>
                <p v-else class="archive__locked-note">In the app with Pro</p>
            </section>

            <template v-else>
                <ul v-if="archiveList.length > 0" class="archive__list">
                    <li v-for="item in archiveList" :key="item.date">
                        <NuxtLink class="archive__row" :to="{ path: '/daily', query: { date: item.date } }" @click="handleRow(item)">
                            <span class="archive__row-text">{{ archiveRowText(item) }}</span>
                            <AppIcon class="archive__chevron" name="chevron" />
                        </NuxtLink>
                    </li>
                </ul>

                <p v-else-if="loaded && !loadError" class="archive__muted">No past Dailies yet. Check back tomorrow.</p>
                <p v-if="loadError" aria-live="polite" class="archive__error">{{ loadError }}</p>
                <p v-if="loading" class="archive__muted">Loading…</p>

                <button v-if="archiveNextBefore && !loading" class="archive__more" type="button" @click="handleMore">Older Dailies</button>
            </template>
        </div>
    </main>
</template>

<style lang="scss" scoped>
.archive {
    align-items: center;
    box-sizing: border-box;
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem 1rem 2rem;
}

.archive__inner {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 26rem;
    width: 100%;

    p {
        margin: 0;
    }
}

.archive__title {
    font-size: 2rem;
    margin: 0.25rem 0 0;
}

.archive__lede {
    color: var(--color-muted);
    font-size: 0.88rem;
}

.archive__locked {
    align-items: center;
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 1.5rem 1rem;
    text-align: center;
}

.archive__lock {
    color: var(--color-muted);
    height: 1.5rem;
    width: 1.5rem;
}

.archive__locked-title {
    font-size: 1rem;
    font-weight: 700;
}

.archive__locked-note {
    color: var(--color-muted);
    font-size: 0.85rem;
}

.archive__unlock {
    background-color: var(--color-bib);
    border: 0;
    border-radius: var(--radius-stub);
    color: var(--color-on-bib);
    cursor: pointer;
    font: inherit;
    font-weight: 700;
    min-height: 3rem;
    padding: 0 2rem;
}

.archive__list {
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    list-style: none;
    margin: 0;
    overflow: hidden;
    padding: 0;
}

.archive__list li + li {
    border-top: 1px solid var(--color-line);
}

.archive__row {
    align-items: center;
    background-color: var(--color-surface);
    color: var(--color-foreground);
    display: flex;
    font-size: 0.88rem;
    font-weight: 600;
    gap: 0.5rem;
    justify-content: space-between;
    line-height: 1.35;
    min-height: 3.25rem;
    padding: 0.5rem 0.75rem 0.5rem 1rem;
    text-decoration: none;
}

.archive__row:hover {
    background-color: var(--color-surface-2);
}

.archive__chevron {
    color: var(--color-muted);
    flex-shrink: 0;
}

.archive__muted {
    color: var(--color-muted);
    font-size: 0.88rem;
    text-align: center;
}

// Errors are amber, never red.
.archive__error {
    background-color: color-mix(in srgb, var(--color-amber) 12%, var(--color-surface));
    border: 1px solid color-mix(in srgb, var(--color-amber) 40%, transparent);
    border-radius: var(--radius-md);
    font-size: 0.85rem;
    font-weight: 600;
    padding: 0.6rem 0.75rem;
}

.archive__more {
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    color: var(--color-foreground);
    cursor: pointer;
    font: inherit;
    font-weight: 700;
    min-height: var(--tap-min);
}
</style>
