<script setup lang="ts">
import type { Player } from '../../shared/types';
import { dayStatValue, scoreDaily } from '#shared/daily2-rules';
import { trackEvent } from '../utils/analytics';
import {
    formatPoints,
    fullTimeStatusLine,
    perfectXIsLine,
    percentileLine,
    scoreBreakdown,
    shareGridRows,
    streakLine,
} from '../utils/daily-screens';
import { describeSlotRole } from '../utils/formations';
import { isAppBuild } from '../utils/platform';
import { buildShareCardBlob, shareOrDownloadBlob } from '../utils/share-card';

// The Daily 2.0 full-time card (DAILY2_SPEC §6.8): score out of 1,000 with
// its breakdown, the percentile, the share grid, the best possible XI, how
// many perfect XIs there were, and the hidden numbers of every option you
// passed on. Before /submit answers it shows the score from the shared
// engine and a pending / offline / retry line.
const emit = defineEmits<{
    recap: [];
}>();

const { state } = useGame();
const {
    puzzle,
    snapshot,
    result,
    submitState,
    submit,
    isArchive,
    isRanked,
    shareText,
    archiveAvailable,
    countdown,
    recapAvailable,
    today,
} = useDaily();
const { stats, currentDailyStreak, currentDailyWinStreak } = useStats();
const { openShop } = useShop();
const isApp = isAppBuild();

const stat = computed(() => puzzle.value?.objective.stat ?? 'ga');

// The server's score once submitted; until then the same shared engine's.
const score = computed(() => {
    if (result.value) {
        return result.value.score;
    }

    return snapshot.value && puzzle.value ? scoreDaily(snapshot.value, puzzle.value.objective) : null;
});

const statusLine = computed(() => (score.value && puzzle.value ? fullTimeStatusLine(score.value, puzzle.value.objective.kind) : ''));
const breakdown = computed(() => (score.value && snapshot.value ? scoreBreakdown(score.value, snapshot.value.helps) : ''));
const tone = computed(() => score.value?.status ?? 'lost');

const percentile = computed(() => {
    if (!result.value) {
        return null;
    }

    return percentileLine(result.value.percentile, result.value.ranked, !!puzzle.value?.isToday);
});

const isOffline = ref(false);

onMounted(() => {
    isOffline.value = typeof navigator !== 'undefined' && navigator.onLine === false;
    trackEvent('view_full_time', { date: puzzle.value?.date, archive: isArchive.value });
});

const submitLine = computed(() => {
    if (result.value) {
        return null;
    }

    if (submitState.value === 'failed') {
        return isOffline.value ? 'Saved. We\'ll post your score when you\'re back online.' : null;
    }

    return submitState.value === 'pending' ? 'Posting your score…' : null;
});

const retryVisible = computed(() => !result.value && submitState.value === 'failed' && !isOffline.value);
const retrying = ref(false);

async function retrySubmit(): Promise<void> {
    if (retrying.value) {
        return;
    }

    retrying.value = true;
    trackEvent('daily_submit_retry', { archive: isArchive.value });

    try {
        await submit();
    } finally {
        retrying.value = false;
        isOffline.value = typeof navigator !== 'undefined' && navigator.onLine === false;
    }
}

const streak = computed(() => (today.value ? currentDailyStreak(today.value) : stats.value.dailyStreak));
const winStreak = computed(() => (today.value ? currentDailyWinStreak(today.value) : stats.value.dailyWinStreak));

interface XIRow {
    slotId: string;
    role: string;
    player: Player;
    value: number;
    captain: boolean;
}

function roleFor(slotId: string): string {
    const slot = state.value?.slots.find((candidate) => candidate.id === slotId);

    return slot ? describeSlotRole(slot.group, slot.side, slot.rowSize) : '';
}

const bestXI = computed<XIRow[]>(() => {
    const fullTime = result.value?.fullTime;

    if (!fullTime) {
        return [];
    }

    return fullTime.bestXI.picks.map(({ slotId, player }) => ({
        slotId,
        role: roleFor(slotId),
        player,
        value: dayStatValue(player, stat.value),
        captain: slotId === fullTime.bestXI.captainSlotId,
    }));
});

const passedOn = computed(() => (result.value?.fullTime.passedOn ?? []).map((entry) => ({
    key: `${entry.slotId}-${entry.player.id}`,
    role: roleFor(entry.slotId),
    player: entry.player,
    value: dayStatValue(entry.player, stat.value),
    reroll: entry.set === 'reroll',
})));

const perfectLine = computed(() => (result.value && puzzle.value ? perfectXIsLine(result.value.fullTime, puzzle.value.objective.kind) : null));

// ---- sharing ------------------------------------------------------------

const copied = ref(false);
let copiedTimeout: number | undefined;

async function handleShareGrid(): Promise<void> {
    const text = shareText();

    if (!text || !navigator.clipboard?.writeText) {
        return;
    }

    try {
        await navigator.clipboard.writeText(text);
        copied.value = true;
        trackEvent('share_copied', { source: 'daily', formation: puzzle.value?.formationCode, archive: isArchive.value });
        window.clearTimeout(copiedTimeout);
        copiedTimeout = window.setTimeout(() => {
            copied.value = false;
        }, 2000);
    } catch {
        // Clipboard blocked: an optional convenience, so fail quietly.
    }
}

const shareImageLabel = ref('Share image');
const sharingImage = ref(false);

async function handleShareImage(): Promise<void> {
    const current = puzzle.value;
    const submitted = result.value;

    if (!current || !submitted || sharingImage.value) {
        return;
    }

    sharingImage.value = true;

    try {
        const beat = submitted.percentile?.beatPct;
        const blob = await buildShareCardBlob({
            heading: `${submitted.score.score} / 1000`,
            subheading: `${statusLine.value} · ${current.objective.label}`,
            highlight: { label: 'Full time', value: String(submitted.score.score) },
            lines: [
                typeof beat === 'number' ? `Beat ${beat}% of players` : `Daily · ${current.date}`,
                'exacteleven.co.uk/daily',
            ],
            tone: submitted.score.status === 'won' ? 'win' : submitted.score.status === 'bust' ? 'bust' : undefined,
            grid: shareGridRows(submitted.fullTime.grid).map((row, rowIndex) => row.map((level, cellIndex) => ({
                level,
                captain: shareCaptainAt(rowIndex, cellIndex),
            }))),
        });

        if (blob) {
            const outcome = await shareOrDownloadBlob(blob, `exact-xi-daily-${current.date}.png`, { title: 'Exact XI Daily', text: shareText() });

            shareImageLabel.value = outcome === 'shared' ? 'Shared!' : 'Saved!';
            trackEvent('share_image', { source: 'daily', formation: current.formationCode, result: outcome, archive: isArchive.value });
        }
    } catch {
        // Share sheet dismissed or canvas unavailable: optional, fail quietly.
    } finally {
        sharingImage.value = false;
        window.setTimeout(() => {
            shareImageLabel.value = 'Share image';
        }, 2000);
    }
}

// Whether the grid cell at (row, index) in shareGridRows order is the captain.
function shareCaptainAt(rowIndex: number, cellIndex: number): boolean {
    const grid = result.value?.fullTime.grid ?? [];
    const groups = (['FWD', 'MID', 'DEF', 'GK'] as const).filter((group) => grid.some((cell) => cell.group === group));
    const group = groups[rowIndex];

    return !!grid.filter((cell) => cell.group === group)[cellIndex]?.captain;
}

// ---- archive + recap -------------------------------------------------------

function handleArchiveLocked(): void {
    trackEvent('archive_locked', { source: 'full_time' });
    openShop('archive');
}

function handleArchive(): void {
    trackEvent('view_archive', { source: 'full_time' });
}

function handlePassedToggle(event: Event): void {
    if ((event.target as HTMLDetailsElement).open) {
        trackEvent('view_passed_on', { date: puzzle.value?.date, archive: isArchive.value });
    }
}

function handleRecap(): void {
    emit('recap');
}

onUnmounted(() => {
    window.clearTimeout(copiedTimeout);
});
</script>

<template>
    <section v-if="score && puzzle" class="full-time" :class="`full-time--${tone}`">
        <p class="full-time__eyebrow">{{ isArchive ? 'Archive · full time' : 'Daily · full time' }}</p>

        <div class="full-time__score">
            <span class="full-time__points">{{ formatPoints(score.score) }}</span>
            <span class="full-time__out-of">/ 1,000</span>
        </div>
        <p class="full-time__status">{{ statusLine }}</p>
        <p class="full-time__breakdown">{{ breakdown }}</p>

        <p v-if="percentile" class="full-time__percentile">{{ percentile }}</p>
        <p v-if="submitLine" aria-live="polite" class="full-time__pending">{{ submitLine }}</p>
        <div v-if="retryVisible" aria-live="polite" class="full-time__retry">
            <span>Couldn't post your score. Try again.</span>
            <button :aria-disabled="retrying" class="full-time__retry-button" type="button" @click="retrySubmit">Try again</button>
        </div>

        <p v-if="!isArchive && isRanked !== false" class="full-time__streak">{{ streakLine(streak, winStreak) }}</p>

        <DailyShareGrid v-if="result" :grid="result.fullTime.grid" />

        <div class="full-time__actions">
            <button v-if="result" class="full-time__action full-time__action--primary" type="button" @click="handleShareGrid">
                {{ copied ? 'Copied!' : 'Share grid' }}
            </button>
            <button v-if="result" class="full-time__action" type="button" @click="handleShareImage">{{ shareImageLabel }}</button>
            <NuxtLink v-if="archiveAvailable" class="full-time__action full-time__action--wide" to="/daily-archive" @click="handleArchive">
                Daily archive
            </NuxtLink>
            <button v-else-if="isApp" class="full-time__action full-time__action--wide" type="button" @click="handleArchiveLocked">
                <AppIcon name="lock" />
                Daily archive · Pro
            </button>
            <button v-if="recapAvailable && !isArchive" class="full-time__action full-time__action--wide" type="button" @click="handleRecap">
                {{ recapAvailable === 'thisWeek' ? 'Your week' : 'Last week' }}
            </button>
        </div>

        <template v-if="result">
            <section class="full-time__section">
                <h3 class="full-time__heading">Best possible XI</h3>
                <p v-if="perfectLine" class="full-time__perfect">{{ perfectLine }}</p>
                <ol class="full-time__list">
                    <li v-for="row in bestXI" :key="row.slotId" class="full-time__row">
                        <span class="full-time__role">{{ row.role }}</span>
                        <span class="full-time__name">
                            {{ row.player.name }}
                            <span v-if="row.captain" class="full-time__captain" title="Captain">C</span>
                        </span>
                        <span class="full-time__value">{{ row.captain ? `${row.value}×2` : row.value }}</span>
                    </li>
                </ol>
                <p class="full-time__total">Total {{ result.fullTime.bestXI.total }}</p>
            </section>

            <details v-if="passedOn.length > 0" class="full-time__section full-time__passed" @toggle="handlePassedToggle">
                <summary class="full-time__heading full-time__summary">
                    Players you passed on ({{ passedOn.length }})
                    <AppIcon class="full-time__chevron" name="chevron" />
                </summary>
                <ol class="full-time__list">
                    <li v-for="row in passedOn" :key="row.key" class="full-time__row">
                        <span class="full-time__role">{{ row.role }}{{ row.reroll ? ' · reroll' : '' }}</span>
                        <span class="full-time__name">{{ row.player.name }}</span>
                        <span class="full-time__value">{{ row.value }}</span>
                    </li>
                </ol>
            </details>
        </template>

        <p v-if="!isArchive && countdown" class="full-time__next">Next Daily in {{ countdown }}</p>
    </section>
</template>

<style lang="scss" scoped>
.full-time {
    --tone: var(--color-foreground);

    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-sm);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 1.25rem;
    width: 100%;

    p {
        margin: 0;
    }
}

// A win is the red moment; a bust is slate, never red.
.full-time--won {
    --tone: var(--color-bib);

    background-color: color-mix(in srgb, var(--color-bib) 6%, var(--color-surface));
    border-color: color-mix(in srgb, var(--color-bib) 45%, transparent);
}

.full-time--bust {
    --tone: var(--color-bust);
}

.full-time__eyebrow {
    color: var(--color-muted);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}

.full-time__score {
    align-items: baseline;
    display: flex;
    gap: 0.4rem;
}

.full-time__points {
    color: var(--tone);
    font-family: var(--font-display);
    font-size: 4rem;
    font-variant-numeric: tabular-nums;
    font-weight: 900;
    line-height: 0.9;
}

.full-time__out-of {
    color: var(--color-muted);
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 800;
}

.full-time__status {
    font-family: var(--font-display);
    font-size: 1.4rem;
    font-weight: 900;
    line-height: 1.1;
    text-transform: var(--display-text-transform);
}

.full-time__breakdown {
    color: var(--color-muted);
    font-family: var(--font-mono);
    font-size: 0.78rem;
    font-variant-numeric: tabular-nums;
}

.full-time__percentile {
    font-size: 0.95rem;
    font-weight: 700;
}

.full-time__pending {
    color: var(--color-muted);
    font-size: 0.85rem;
}

// Errors are amber, never red.
.full-time__retry {
    align-items: center;
    background-color: color-mix(in srgb, var(--color-amber) 12%, var(--color-surface));
    border: 1px solid color-mix(in srgb, var(--color-amber) 40%, transparent);
    border-radius: var(--radius-md);
    display: flex;
    font-size: 0.85rem;
    font-weight: 600;
    gap: 0.5rem;
    justify-content: space-between;
    padding: 0.25rem 0.25rem 0.25rem 0.75rem;
}

.full-time__retry-button {
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
    color: var(--color-foreground);
    cursor: pointer;
    font: inherit;
    font-weight: 700;
    min-height: var(--tap-min);
    padding: 0 0.85rem;
}

.full-time__streak {
    font-size: 0.88rem;
    font-weight: 600;
}

.full-time__actions {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: 1fr 1fr;
}

.full-time__action {
    align-items: center;
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    box-sizing: border-box;
    color: var(--color-foreground);
    cursor: pointer;
    display: flex;
    font: inherit;
    font-weight: 700;
    gap: 0.4rem;
    justify-content: center;
    min-height: var(--tap-min);
    padding: 0.6rem 1rem;
    text-decoration: none;
}

.full-time__action:hover {
    border-color: var(--color-primary);
}

.full-time__action--primary {
    background-color: var(--color-bib);
    border-color: var(--color-bib);
    color: var(--color-on-bib);
}

.full-time__action--primary:hover {
    border-color: var(--color-foreground);
}

.full-time__action--wide {
    grid-column: 1 / -1;
}

.full-time__section {
    border-top: 1px solid var(--color-line);
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    padding-top: 0.75rem;
}

.full-time__heading {
    color: var(--color-muted);
    font-family: var(--font-body);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    margin: 0;
    text-transform: uppercase;
}

.full-time__summary {
    align-items: center;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    list-style: none;
    min-height: var(--tap-min);
}

.full-time__summary::-webkit-details-marker {
    display: none;
}

.full-time__chevron {
    transform: rotate(90deg);
    transition: transform 0.15s ease;
}

.full-time__passed[open] .full-time__chevron {
    transform: rotate(-90deg);
}

.full-time__perfect {
    font-size: 0.88rem;
    font-weight: 600;
}

.full-time__list {
    display: flex;
    flex-direction: column;
    list-style: none;
    margin: 0;
    padding: 0;
}

.full-time__row {
    align-items: center;
    display: grid;
    gap: 0 0.6rem;
    grid-template-columns: 1fr auto;
    padding: 0.35rem 0;
}

.full-time__row + .full-time__row {
    border-top: 1px solid var(--color-line);
}

.full-time__role {
    color: var(--color-muted);
    font-size: 0.65rem;
    font-weight: 700;
    grid-column: 1;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.full-time__name {
    align-items: center;
    display: flex;
    font-size: 0.9rem;
    font-weight: 600;
    gap: 0.35rem;
    grid-column: 1;
    min-width: 0;
}

.full-time__captain {
    align-items: center;
    background-color: var(--color-bib);
    border-radius: var(--radius-sm);
    color: var(--color-on-bib);
    display: inline-flex;
    font-family: var(--font-display);
    font-size: 0.7rem;
    font-weight: 900;
    height: 1.05rem;
    justify-content: center;
    width: 1.05rem;
}

.full-time__value {
    font-family: var(--font-mono);
    font-size: 0.95rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    grid-column: 2;
    grid-row: 1 / span 2;
}

.full-time__total {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    font-weight: 700;
    text-align: right;
}

.full-time__next {
    color: var(--color-muted);
    font-size: 0.82rem;
    text-align: center;
}
</style>
