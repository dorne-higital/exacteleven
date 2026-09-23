<script setup lang="ts">
import type { ResultTier } from '../../shared/types';
import { trackEvent } from '../utils/analytics';
import { getSlotShortLabel } from '../utils/formations';
import { getDistance } from '../utils/scoring';

type Tone = 'win' | ResultTier | 'bust';

interface Outcome {
    label: string;
    tone: Tone;
    detail: string;
}

// League-table language matching the tier boundaries in scoring.ts — worst
// to best: relegated < avoidedRelegation < midTable < europaLeague <
// championsLeague < win (exact only). Each tier gets its own label and
// flavor of detail text, not just a generic template with the name swapped
// in.
const TIER_COPY: Record<ResultTier, { label: string; detail: (distance: number, target: number) => string }> = {
    championsLeague: {
        label: 'Champions League',
        detail: (distance, target) => `${distance} off ${target} — a genuine near-miss.`,
    },
    europaLeague: {
        label: 'Europa League',
        detail: (distance, target) => `${distance} off ${target} — a solid finish.`,
    },
    midTable: {
        label: 'Mid-table',
        detail: (distance, target) => `${distance} off ${target} — solid mid-table.`,
    },
    avoidedRelegation: {
        label: 'Avoided relegation',
        detail: (distance, target) => `${distance} off ${target} — scraped clear of the bottom.`,
    },
    relegated: {
        label: 'Relegated',
        detail: (distance, target) => `${distance} off ${target} — a rough one.`,
    },
};

// Wordle-style: one line, no image, a distinct symbol per tier. 🏆 is
// reserved for the Champion (exact) outcome below, so the tiers start at ⭐.
const TIER_EMOJI: Record<ResultTier, string> = {
    championsLeague: '⭐',
    europaLeague: '🟢',
    midTable: '🟡',
    avoidedRelegation: '🟠',
    relegated: '🔴',
};

const { state, startGame } = useGame();

const recap = computed(() => (state.value?.slots ?? []).filter((slot) => slot.player));

// The teamsheet used to be one flat list where every row looked the same —
// pulling out the top contributor as its own spotlight moment gives the
// list a focal point, and lets the remaining rows go small and quiet
// instead of repeating the same layout eleven times.
const starSlot = computed(() => {
    if (recap.value.length === 0) {
        return null;
    }

    return recap.value.reduce((best, slot) => (statTotal(slot.player!) > statTotal(best.player!) ? slot : best));
});

const otherSlots = computed(() => recap.value.filter((slot) => slot.id !== starSlot.value?.id));

// Visually hidden but always present (not inside the v-if'd section below)
// so screen readers pick up its text change reliably — an element that
// enters the DOM for the first time with aria-live already set is
// inconsistently announced across AT (same reasoning as
// PlayerChoiceDialog's srAnnouncement).
const srAnnouncement = ref('');

const outcome = computed<Outcome | null>(() => {
    const game = state.value;

    if (!game) {
        return null;
    }

    if (game.status === 'won') {
        return { label: 'Champion', tone: 'win', detail: `Exact match — ${game.total} on the nose.` };
    }

    if (game.status === 'bust') {
        return { label: 'Bust', tone: 'bust', detail: `${game.total} went over the ${game.target} target.` };
    }

    if (game.status === 'finished' && game.tier) {
        const tier = TIER_COPY[game.tier];

        return { label: tier.label, tone: game.tier, detail: tier.detail(getDistance(game.total, game.target), game.target) };
    }

    return null;
});

// CSS class names stay kebab-case (matching every other class in this file)
// even though ResultTier's own values are camelCase (matching the rest of
// the codebase's TS conventions).
const TONE_CLASS: Record<Tone, string> = {
    win: 'win',
    championsLeague: 'champions-league',
    europaLeague: 'europa-league',
    midTable: 'mid-table',
    avoidedRelegation: 'avoided-relegation',
    relegated: 'relegated',
    bust: 'bust',
};

const toneClass = computed(() => (outcome.value ? TONE_CLASS[outcome.value.tone] : ''));

watch(outcome, (value) => {
    if (value) {
        srAnnouncement.value = `${value.label}. ${value.detail}`;
    }
});

const resultEmoji = computed(() => {
    const game = state.value;

    if (!game) {
        return '';
    }

    if (game.status === 'bust') {
        return '💥';
    }

    if (game.status === 'won') {
        return '🏆';
    }

    return game.tier ? TIER_EMOJI[game.tier] : '';
});

const siteConfig = useSiteConfig();

// Wordle-style share text only works as a growth loop if a curious reader
// can actually tap through — without a trailing link, a copy-pasted result
// gives them nothing to click.
const shareText = computed(() => {
    const game = state.value;

    return game ? `Exact XI · ${game.formationCode} ${resultEmoji.value} ${game.total}/${game.target}\n${siteConfig.url}` : '';
});

const copied = ref(false);
let copiedTimeout: number | undefined;

async function handleCopy(): Promise<void> {
    if (!navigator.clipboard?.writeText) {
        return;
    }

    try {
        await navigator.clipboard.writeText(shareText.value);
        copied.value = true;
        trackEvent('share_copied', { formation: state.value?.formationCode });
        window.clearTimeout(copiedTimeout);
        copiedTimeout = window.setTimeout(() => {
            copied.value = false;
        }, 2000);
    } catch {
        // Clipboard permission denied, or unavailable in this context — this
        // is an optional convenience feature, so fail silently rather than
        // showing an error for something this low-stakes.
    }
}

function handlePlayAgain(): void {
    if (state.value) {
        startGame(state.value.formationCode);
    }
}

function statTotal(player: { goals: number; assists: number }): number {
    return player.goals + player.assists;
}

function statCaption(player: { goals: number; assists: number }): string {
    const goalWord = player.goals === 1 ? 'goal' : 'goals';
    const assistWord = player.assists === 1 ? 'assist' : 'assists';

    return `${player.goals} ${goalWord} · ${player.assists} ${assistWord}`;
}

// The compact teamsheet rows only have room for a glance, not full words —
// this sits inline right before the tally, unlike statCaption's spelled-out
// form in the star man spotlight above, which has the space for it.
function compactStatCaption(player: { goals: number; assists: number }): string {
    return `${player.goals}g · ${player.assists}a`;
}

// D2's hidden-stats rule only applies while a game is in progress — this
// component only ever renders once `status` has left 'playing' (see
// app/pages/play.vue), so showing goals/assists openly here is correct, not
// a leak.
</script>

<template>
    <p aria-live="polite" class="result-panel__sr-announcement">{{ srAnnouncement }}</p>
    <section v-if="outcome && state" class="result-panel" :class="`result-panel--${toneClass}`">
        <h2 class="result-panel__headline">{{ outcome.label }}</h2>
        <p class="result-panel__detail">{{ outcome.detail }}</p>

        <dl class="result-panel__stats">
            <div class="result-panel__stat">
                <dt>Target</dt>
                <dd>{{ state.target }}</dd>
            </div>
            <div class="result-panel__stat">
                <dt>Total</dt>
                <dd>{{ state.total }}</dd>
            </div>
            <div v-if="outcome.tone !== 'win'" class="result-panel__stat">
                <dt>Distance</dt>
                <dd>{{ getDistance(state.total, state.target) }}</dd>
            </div>
        </dl>

        <div class="result-panel__actions">
            <button class="result-panel__action result-panel__action--primary" type="button" @click="handlePlayAgain">
                Play again
            </button>
            <NuxtLink class="result-panel__action" to="/">Change formation</NuxtLink>
        </div>

        <div class="result-panel__share">
            <code class="result-panel__share-text">{{ shareText }}</code>
            <button class="result-panel__share-copy" type="button" @click="handleCopy">
                {{ copied ? 'Copied!' : 'Copy' }}
            </button>
        </div>

        <div v-if="starSlot" class="result-panel__starman">
            <svg aria-hidden="true" class="result-panel__starman-icon" fill="currentColor" height="28" viewBox="0 0 24 24" width="28">
                <path d="M12 2l2.9 6.6L22 9.3l-5 4.8 1.3 7L12 17.8 5.7 21l1.3-7-5-4.8 7.1-0.7z" />
            </svg>
            <div class="result-panel__starman-info">
                <p class="result-panel__starman-label">
                    Star man · {{ getSlotShortLabel(starSlot.group, starSlot.side, starSlot.rowSize) }}
                </p>
                <p class="result-panel__starman-name">{{ starSlot.player?.name }}</p>
                <p class="result-panel__starman-caption">{{ statCaption(starSlot.player!) }}</p>
            </div>
            <span class="result-panel__starman-total">{{ statTotal(starSlot.player!) }}</span>
        </div>

        <ol class="result-panel__recap">
            <li v-for="slot in otherSlots" :key="slot.id" class="result-panel__recap-item">
                <span class="result-panel__recap-role">{{ getSlotShortLabel(slot.group, slot.side, slot.rowSize) }}</span>
                <span class="result-panel__recap-name">{{ slot.player?.name }}</span>
                <span class="result-panel__recap-caption">{{ compactStatCaption(slot.player!) }}</span>
                <span class="result-panel__recap-total">{{ statTotal(slot.player!) }}</span>
            </li>
        </ol>
    </section>
</template>

<style lang="scss" scoped>
// Visually hidden but always present (not v-if'd) so screen readers pick up
// its text changes reliably — an element that appears for the first time
// with aria-live already set is inconsistently announced across AT.
.result-panel__sr-announcement {
    border: 0;
    clip-path: inset(50%);
    height: 1px;
    margin: -1px;
    overflow: hidden;
    padding: 0;
    position: absolute;
    white-space: nowrap;
    width: 1px;
}

// Mobile-first, filling whatever width its parent (.play__inner, capped and
// centered) already provides — no separate max-width needed here.
.result-panel {
    background-color: var(--color-surface);
    border: 1px solid color-mix(in srgb, var(--color-foreground) 15%, transparent);
    border-left: 4px solid var(--color-foreground);
    border-radius: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem;
    width: 100%;
}

// A single coherent progression built from the same 3 tokens the rest of
// the app already uses (primary/foreground/danger) — not 7 arbitrary
// colors. Best to worst: full primary -> primary blending toward neutral ->
// neutral (mid-table has no strong hue — it's supposed to read as
// unremarkable) -> danger blending in -> full danger (relegated and bust
// both read as "danger", relegated slightly softer since it isn't a
// game-ending state the way bust is).
.result-panel--win {
    border-left-color: var(--color-primary);
}

.result-panel--champions-league {
    border-left-color: color-mix(in srgb, var(--color-primary) 85%, var(--color-foreground) 15%);
}

.result-panel--europa-league {
    border-left-color: color-mix(in srgb, var(--color-primary) 55%, var(--color-foreground) 45%);
}

.result-panel--mid-table {
    border-left-color: color-mix(in srgb, var(--color-foreground) 35%, transparent);
}

.result-panel--avoided-relegation {
    border-left-color: color-mix(in srgb, var(--color-danger) 55%, var(--color-foreground) 45%);
}

.result-panel--relegated {
    border-left-color: color-mix(in srgb, var(--color-danger) 80%, var(--color-foreground) 20%);
}

.result-panel--bust {
    border-left-color: var(--color-danger);
}

.result-panel__headline {
    font-size: 1.5rem;
    margin: 0;
}

.result-panel--win .result-panel__headline,
.result-panel--champions-league .result-panel__headline {
    color: var(--color-primary);
}

.result-panel--europa-league .result-panel__headline {
    color: color-mix(in srgb, var(--color-primary) 65%, var(--color-foreground) 35%);
}

.result-panel--avoided-relegation .result-panel__headline {
    color: color-mix(in srgb, var(--color-danger) 65%, var(--color-foreground) 35%);
}

.result-panel--relegated .result-panel__headline,
.result-panel--bust .result-panel__headline {
    color: var(--color-danger);
}

.result-panel__detail {
    margin: 0;
}

.result-panel__stats {
    display: flex;
    gap: 1.5rem;
    margin: 0;
}

.result-panel__stat {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
}

.result-panel__stat dt {
    color: color-mix(in srgb, var(--color-foreground) 70%, transparent);
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.result-panel__stat dd {
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0;
}

// Pulled out of the flat list below as its own moment — the same
// primary/foreground/danger tokens the rest of the panel already uses, so
// it reads correctly in both themes rather than a fixed color baked in for
// one of them.
.result-panel__starman {
    align-items: center;
    background: linear-gradient(
        135deg,
        color-mix(in srgb, var(--color-primary) 16%, transparent),
        color-mix(in srgb, var(--color-primary) 3%, transparent)
    );
    border: 1px solid color-mix(in srgb, var(--color-primary) 35%, transparent);
    border-radius: 0.75rem;
    display: flex;
    gap: 0.875rem;
    padding: 0.875rem 1rem;
}

.result-panel__starman-icon {
    color: var(--color-primary);
    flex-shrink: 0;
}

.result-panel__starman-info {
    flex-grow: 1;
    min-width: 0;
}

.result-panel__starman-label {
    color: var(--color-primary);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    margin: 0;
    text-transform: uppercase;
}

.result-panel__starman-name {
    font-family: var(--font-display);
    font-size: 1.15rem;
    margin: 0.15rem 0 0;
    overflow: hidden;
    text-overflow: ellipsis;
    text-transform: var(--display-text-transform);
    white-space: nowrap;
}

.result-panel__starman-caption {
    color: color-mix(in srgb, var(--color-foreground) 70%, transparent);
    font-size: 0.75rem;
    margin: 0.15rem 0 0;
}

.result-panel__starman-total {
    color: var(--color-primary);
    flex-shrink: 0;
    font-family: var(--font-display);
    font-size: 1.75rem;
    font-variant-numeric: tabular-nums;
}

// The rest of the XI: one line each, quiet next to the spotlight above —
// role as a small pill instead of its own uppercase line, and the g/a
// breakdown compact right before the tally instead of stacked under it.
.result-panel__recap {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    list-style: none;
    margin: 0;
    padding: 0;
}

.result-panel__recap-item {
    align-items: center;
    display: flex;
    gap: 0.5rem;
    padding: 0.3rem 0;
}

.result-panel__recap-role {
    border: 1px solid color-mix(in srgb, var(--color-foreground) 20%, transparent);
    border-radius: 999px;
    color: color-mix(in srgb, var(--color-foreground) 70%, transparent);
    flex-shrink: 0;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    padding: 0.1rem 0.45rem;
}

.result-panel__recap-name {
    flex-grow: 1;
    font-size: 0.85rem;
    font-weight: 600;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.result-panel__recap-caption {
    color: color-mix(in srgb, var(--color-foreground) 55%, transparent);
    flex-shrink: 0;
    font-size: 0.68rem;
    white-space: nowrap;
}

.result-panel__recap-total {
    flex-shrink: 0;
    font-family: var(--font-display);
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
}

.result-panel__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
}

.result-panel__action {
    background-color: color-mix(in srgb, var(--color-foreground) 8%, transparent);
    border: 1px solid color-mix(in srgb, var(--color-foreground) 20%, transparent);
    border-radius: 0.5rem;
    color: inherit;
    cursor: pointer;
    flex: 1 1 auto;
    font: inherit;
    padding: 0.6rem 1rem;
    text-align: center;
    text-decoration: none;
}

.result-panel__action--primary {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-background);
    font-weight: 700;
}

.result-panel__share {
    align-items: center;
    background-color: color-mix(in srgb, var(--color-foreground) 6%, transparent);
    border-radius: 0.5rem;
    display: flex;
    gap: 0.75rem;
    justify-content: space-between;
    padding: 0.6rem 0.75rem;
}

.result-panel__share-text {
    color: color-mix(in srgb, var(--color-foreground) 80%, transparent);
    font-size: 0.8rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.result-panel__share-copy {
    background: none;
    border: 1px solid color-mix(in srgb, var(--color-foreground) 25%, transparent);
    border-radius: 0.4rem;
    color: inherit;
    cursor: pointer;
    flex-shrink: 0;
    font: inherit;
    font-size: 0.75rem;
    padding: 0.3rem 0.6rem;
}
</style>
