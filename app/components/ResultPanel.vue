<script setup lang="ts">
import type { GameState, ResultTier } from '../../shared/types';
import type { ChallengePayload, DailyChallengePayload } from '../composables/useGame';
import type { ShareCardSpec } from '../utils/share-card';
import { trackEvent } from '../utils/analytics';
import { getSlotShortLabel } from '../utils/formations';
import { getDistance } from '../utils/scoring';
import { buildShareCardBlob, shareOrDownloadBlob } from '../utils/share-card';

// 'lost' only ever comes from a Daily Challenge's binary objective outcome —
// the classic game never reaches it (see shared/types.ts's GameStatus).
type Tone = 'win' | ResultTier | 'bust' | 'lost';

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

const { state, startGame, startDailyGame, startChallengeGame } = useGame();

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

// The Daily Challenge's binary won/bust/lost outcome, worded per the day's
// rotating objective kind — kept separate from the classic branch below
// since the copy genuinely differs per kind, not just the numbers plugged in.
function getDailyOutcome(game: GameState): Outcome | null {
    const objective = game.objective;

    if (!objective) {
        return null;
    }

    const { value } = objective;

    if (game.status === 'won') {
        const detail = {
            exact: `Exact match — ${game.total} on the nose.`,
            over: `${game.total} cleared the ${value} target.`,
            under: `${game.total} — stayed under the ${value} ceiling.`,
            allUnder: `Every player stayed under ${value}.`,
        }[objective.kind];

        return { label: 'Challenge won', tone: 'win', detail };
    }

    if (game.status === 'bust') {
        const breachedSlot = recap.value.find((slot) => slot.player && statTotal(slot.player) >= value);
        const detail = {
            exact: `${game.total} went over the ${value} target.`,
            over: `${game.total} went over — this objective shouldn't be able to bust.`,
            under: `${game.total} hit the ${value} ceiling.`,
            allUnder: breachedSlot
                ? `${breachedSlot.player!.name} hit ${statTotal(breachedSlot.player!)}, over the ${value} cap.`
                : `A player's stat reached the ${value} cap.`,
        }[objective.kind];

        return { label: 'Bust', tone: 'bust', detail };
    }

    if (game.status === 'lost') {
        const detail = {
            exact: `${game.total} — needed exactly ${value}.`,
            over: `${game.total} — needed to clear ${value}.`,
            under: `${game.total} — this objective shouldn't be able to end in a loss.`,
            allUnder: `${game.total} — this objective shouldn't be able to end in a loss.`,
        }[objective.kind];

        return { label: 'Not quite', tone: 'lost', detail };
    }

    return null;
}

const outcome = computed<Outcome | null>(() => {
    const game = state.value;

    if (!game) {
        return null;
    }

    if (game.objective) {
        return getDailyOutcome(game);
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
    lost: 'lost',
};

const toneClass = computed(() => (outcome.value ? TONE_CLASS[outcome.value.tone] : ''));

watch(outcome, (value) => {
    if (value) {
        srAnnouncement.value = `${value.label}. ${value.detail}`;
    }
});

// A fixed, non-random spread (not Math.random()) — purely cosmetic values
// like this still don't need real randomness, and staying deterministic
// costs nothing here. Only the first entry is a theme token on purpose — a
// celebration needs a multi-color spread to read as confetti at all, which
// the app's small token set can't supply on its own, so the rest are fixed
// hexes chosen to sit well against both themes (same reasoning as the medal
// colors in AchievementBadge.vue).
const CONFETTI_COLORS = ['var(--color-primary)', '#ffc400', '#ff8a3d', '#4da6ff'];
const CONFETTI_COUNT = 18;

interface ConfettiPiece {
    id: number;
    left: string;
    color: string;
    delay: string;
    rotate: string;
}

const confettiPieces = computed<ConfettiPiece[]>(() => {
    if (outcome.value?.tone !== 'win') {
        return [];
    }

    return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
        id: i,
        left: `${(i * 53) % 100}%`,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
        delay: `${(i % 6) * 0.08}s`,
        rotate: `${(i * 47) % 360}deg`,
    }));
});

// The final total just appearing instantly undersold the one outcome that's
// actually worth celebrating — counting up to it (skipped for
// prefers-reduced-motion, and for every non-win outcome, which show the
// total straight away) gives the Champion result a beat of its own.
const displayTotal = ref(0);
let totalAnimationFrame: number | undefined;

watch(outcome, (value) => {
    const game = state.value;

    if (!value || !game) {
        return;
    }

    if (totalAnimationFrame !== undefined) {
        cancelAnimationFrame(totalAnimationFrame);
        totalAnimationFrame = undefined;
    }

    if (value.tone !== 'win' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        displayTotal.value = game.total;

        return;
    }

    const target = game.total;
    const duration = 700;
    const start = performance.now();

    const tick = (now: number): void => {
        const progress = Math.min((now - start) / duration, 1);

        displayTotal.value = Math.round(target * progress);

        if (progress < 1) {
            totalAnimationFrame = requestAnimationFrame(tick);
        }
    };

    totalAnimationFrame = requestAnimationFrame(tick);
}, { immediate: true });

onUnmounted(() => {
    if (totalAnimationFrame !== undefined) {
        cancelAnimationFrame(totalAnimationFrame);
    }
});

interface ResultStat {
    label: string;
    value: number;
}

// Drives the stats <dl> below — a single list instead of hardcoded rows so
// the classic exact-target game and each of the daily objective kinds can
// show a different (and different number of) stats without templating four
// near-identical variants of the same markup.
const resultStats = computed<ResultStat[]>(() => {
    const game = state.value;

    if (!game || !outcome.value) {
        return [];
    }

    const { objective } = game;

    if (!objective) {
        const stats: ResultStat[] = [
            { label: 'Target', value: game.target },
            { label: 'Total', value: displayTotal.value },
        ];

        if (outcome.value.tone !== 'win') {
            stats.push({ label: 'Distance', value: getDistance(game.total, game.target) });
        }

        return stats;
    }

    const stats: ResultStat[] = [];

    if (objective.kind !== 'allUnder') {
        const label = objective.kind === 'exact' ? 'Target' : objective.kind === 'over' ? 'Goal' : 'Limit';

        stats.push({ label, value: objective.value });
    }

    stats.push({ label: 'Total', value: displayTotal.value });

    return stats;
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

    if (game.status === 'lost') {
        return '❌';
    }

    return game.tier ? TIER_EMOJI[game.tier] : '';
});

const siteConfig = useSiteConfig();

// Wordle-style share text only works as a growth loop if a curious reader
// can actually tap through — without a trailing link, a copy-pasted result
// gives them nothing to click.
const shareText = computed(() => {
    const game = state.value;

    if (!game) {
        return '';
    }

    if (game.objective) {
        const resultWord = game.status === 'won' ? 'WON' : game.status === 'bust' ? 'BUST' : 'LOST';
        const label = game.dailyDate ? `Exact XI Daily · ${game.dailyDate}` : 'Exact XI Challenge';

        return `${label} · ${resultEmoji.value} ${game.objective.label} — ${resultWord} (${game.total})\n${siteConfig.url}`;
    }

    return `Exact XI · ${game.formationCode} ${resultEmoji.value} ${game.total}/${game.target}\n${siteConfig.url}`;
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

const shareImageSpec = computed<ShareCardSpec | null>(() => {
    const game = state.value;

    if (!game || !outcome.value) {
        return null;
    }

    const lines: string[] = [];

    if (starSlot.value?.player) {
        lines.push(`Star man: ${starSlot.value.player.name} (${statTotal(starSlot.value.player)})`);
    }

    lines.push(siteConfig.url);

    return {
        heading: outcome.value.label,
        subheading: outcome.value.detail,
        highlight: { label: 'Total', value: String(displayTotal.value) },
        lines,
    };
});

const shareImageLabel = ref('Share image');
const sharingImage = ref(false);
let shareImageLabelTimeout: number | undefined;

async function handleShareImage(): Promise<void> {
    const spec = shareImageSpec.value;
    const game = state.value;

    if (!spec || !game || sharingImage.value) {
        return;
    }

    sharingImage.value = true;

    try {
        const blob = await buildShareCardBlob(spec);

        if (blob) {
            const filename = game.dailyDate
                ? `exact-xi-daily-${game.dailyDate}.png`
                : `exact-xi-${game.formationCode}${game.objective ? '-challenge' : ''}.png`;
            const result = await shareOrDownloadBlob(blob, filename, { title: 'Exact XI', text: shareText.value });

            shareImageLabel.value = result === 'shared' ? 'Shared!' : 'Saved!';
            trackEvent('share_image', { formation: game.formationCode, result });
        }
    } catch {
        // Share sheet dismissed, or a canvas/Web Share failure — this is an
        // optional flourish, so fail silently rather than showing an error.
    } finally {
        sharingImage.value = false;
        window.clearTimeout(shareImageLabelTimeout);
        shareImageLabelTimeout = window.setTimeout(() => {
            shareImageLabel.value = 'Share image';
        }, 2000);
    }
}

function handlePlayAgain(): void {
    const game = state.value;

    if (!game) {
        return;
    }

    if (game.objective && game.dailyDate) {
        // Reconstructed from the current state rather than re-fetched: a
        // preset slot's player is never overwritten once the game starts
        // (openSlot() bails out on any slot that already has a player), so
        // this is exactly the payload /api/daily originally returned.
        const prefilled = game.slots
            .filter((slot) => slot.preset && slot.player)
            .map((slot) => ({ slotId: slot.id, player: slot.player! }));
        const payload: DailyChallengePayload = {
            date: game.dailyDate,
            formationCode: game.formationCode,
            objective: game.objective,
            prefilled,
        };

        startDailyGame(payload);

        return;
    }

    if (game.objective && game.challengeKey) {
        // Same reconstruction trick as the daily branch above — a challenge's
        // preset slots are never overwritten once the game starts.
        const prefilled = game.slots
            .filter((slot) => slot.preset && slot.player)
            .map((slot) => ({ slotId: slot.id, player: slot.player! }));
        const payload: ChallengePayload = { formationCode: game.formationCode, objective: game.objective, prefilled };

        startChallengeGame(payload, game.challengeKey);

        return;
    }

    startGame(game.formationCode);
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
        <div v-if="confettiPieces.length > 0" aria-hidden="true" class="result-panel__confetti">
            <span
                v-for="piece in confettiPieces"
                :key="piece.id"
                class="result-panel__confetti-piece"
                :style="{ '--piece-color': piece.color, '--piece-left': piece.left, '--piece-rotate': piece.rotate, animationDelay: piece.delay }"
            />
        </div>

        <div v-if="outcome.tone === 'bust'" aria-hidden="true" class="result-panel__stamp">Bust</div>

        <h2 class="result-panel__headline">{{ outcome.label }}</h2>
        <p class="result-panel__detail">{{ outcome.detail }}</p>

        <dl class="result-panel__stats">
            <div v-for="stat in resultStats" :key="stat.label" class="result-panel__stat">
                <dt>{{ stat.label }}</dt>
                <dd>{{ stat.value }}</dd>
            </div>
        </dl>

        <div class="result-panel__actions">
            <button class="result-panel__action result-panel__action--primary" type="button" @click="handlePlayAgain">
                Play again
            </button>
            <NuxtLink v-if="!state.objective" class="result-panel__action" to="/">Change formation</NuxtLink>
        </div>

        <div class="result-panel__share">
            <code class="result-panel__share-text">{{ shareText }}</code>
            <button class="result-panel__share-copy" type="button" @click="handleCopy">
                {{ copied ? 'Copied!' : 'Copy' }}
            </button>
        </div>

        <div class="result-panel__share-extra">
            <button class="result-panel__action" type="button" @click="handleShareImage">{{ shareImageLabel }}</button>
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
// centered) already provides — no separate max-width needed here. position:
// relative + overflow: hidden so the confetti and bust stamp below clip
// cleanly to the card's rounded corners instead of poking past them.
.result-panel {
    background-color: var(--color-surface);
    border: 1px solid color-mix(in srgb, var(--color-foreground) 15%, transparent);
    border-left: 4px solid var(--color-foreground);
    border-radius: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow: hidden;
    padding: 1.25rem;
    position: relative;
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
    animation: result-panel-bust-flash 0.5s ease-out;
    border-left-color: var(--color-danger);
}

// A Daily Challenge "didn't meet the objective" finish — a miss, not a
// disaster, so it sits at the same softness as avoided-relegation rather
// than reusing bust's full danger color or its flash animation.
.result-panel--lost {
    border-left-color: color-mix(in srgb, var(--color-danger) 55%, var(--color-foreground) 45%);
}

@keyframes result-panel-bust-flash {
    0% {
        background-color: color-mix(in srgb, var(--color-danger) 35%, var(--color-surface));
    }

    100% {
        background-color: var(--color-surface);
    }
}

// Both purely celebratory/punitive flourishes — z-index above the card's
// own content (which would otherwise paint over them, since they sit
// earliest in the markup so screen readers reach the real result first).
.result-panel__confetti {
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    position: absolute;
    z-index: 1;
}

.result-panel__confetti-piece {
    animation: result-panel-confetti-fall 1.1s ease-in forwards;
    background: var(--piece-color);
    height: 8px;
    left: var(--piece-left);
    opacity: 0;
    position: absolute;
    top: -10px;
    width: 6px;
}

@keyframes result-panel-confetti-fall {
    0% {
        opacity: 1;
        transform: translateY(0) rotate(var(--piece-rotate));
    }

    100% {
        opacity: 0;
        transform: translateY(170px) rotate(calc(var(--piece-rotate) + 180deg));
    }
}

.result-panel__stamp {
    animation: result-panel-stamp-down 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    border: 3px solid var(--color-danger);
    border-radius: 6px;
    color: var(--color-danger);
    font-family: var(--font-display);
    font-size: 1.3rem;
    letter-spacing: 0.1em;
    padding: 0.15rem 0.85rem;
    pointer-events: none;
    position: absolute;
    right: 1.1rem;
    text-transform: var(--display-text-transform);
    top: 1.1rem;
    transform: rotate(-12deg);
    z-index: 1;
}

@keyframes result-panel-stamp-down {
    0% {
        opacity: 0;
        transform: rotate(-12deg) scale(2.2);
    }

    60% {
        opacity: 1;
    }

    100% {
        opacity: 1;
        transform: rotate(-12deg) scale(1);
    }
}

@media (prefers-reduced-motion: reduce) {
    .result-panel--bust {
        animation: none;
    }

    .result-panel__confetti {
        display: none;
    }

    .result-panel__stamp {
        animation: none;
    }
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

.result-panel--lost .result-panel__headline {
    color: color-mix(in srgb, var(--color-danger) 65%, var(--color-foreground) 35%);
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

.result-panel__share-extra {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
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
