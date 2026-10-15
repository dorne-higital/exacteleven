<script setup lang="ts">
import type { GameState, ResultTier } from '../../shared/types';
import type { ChallengePayload, DailyChallengePayload } from '../composables/useGame';
import type { ShareCardSpec } from '../utils/share-card';
import { trackEvent } from '../utils/analytics';
import { getSlotShortLabel } from '../utils/formations';
import { getDistance, getTierBoundaries } from '../utils/scoring';
import { buildShareCardBlob, shareOrDownloadBlob } from '../utils/share-card';
import { TIER_COPY } from '../utils/tier-copy';

// 'lost' only ever comes from a Daily Challenge's binary objective outcome —
// the classic game never reaches it (see shared/types.ts's GameStatus).
type Tone = 'win' | ResultTier | 'bust' | 'lost';

interface Outcome {
    label: string;
    tone: Tone;
    detail: string;
}

// League-table language, share emoji and detail lines come from
// utils/tier-copy.ts (shared with HowToPlayContent and StatsDialog), worst
// to best: relegated < avoidedRelegation < midTable < europaLeague <
// championsLeague < titleWinners < win (exact only).
const { state, startGame, startDailyGame, startChallengeGame, replaySameFormation } = useGame();

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
    titleWinners: 'title-winners',
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
// costs nothing here. All theme tokens: bib red leads (the exact hit is the
// red moment), with pitch green, amber and teal as the bunting around it.
const CONFETTI_COLORS = ['var(--color-bib)', 'var(--color-primary)', 'var(--color-bib)', 'var(--color-amber)', 'var(--color-teal)'];
const CONFETTI_COUNT = 22;

interface ConfettiPiece {
    id: number;
    left: string;
    color: string;
    delay: string;
    rotate: string;
    drift: string;
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
        drift: `${((i * 29) % 60) - 30}px`,
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

interface LadderRung {
    key: string;
    label: string;
    range: string;
    tone: string;
    hit: boolean;
}

// The handbook's result-screen ladder: every finish the classic game can
// reach, best to worst, with the one this game landed on highlighted. Built
// from scoring.ts's getTierBoundaries(target) so the ranges can never drift from the
// real scoring. Daily/challenge objectives are binary, and a bust sits off
// the ladder entirely, so neither shows it.
const ladder = computed<LadderRung[]>(() => {
    const game = state.value;

    if (!game || game.objective || (game.status !== 'won' && game.status !== 'finished')) {
        return [];
    }

    const rungs: LadderRung[] = [
        { key: 'exact', label: 'Champion', range: 'exact', tone: 'win', hit: game.status === 'won' },
    ];
    let previousMax = 0;

    for (const { tier, maxDistance } of getTierBoundaries(game.target)) {
        rungs.push({
            key: tier,
            label: TIER_COPY[tier].label,
            range: Number.isFinite(maxDistance) ? `within ${maxDistance}` : `${previousMax + 1}+`,
            tone: TONE_CLASS[tier],
            hit: game.status === 'finished' && game.tier === tier,
        });
        previousMax = maxDistance;
    }

    return rungs;
});

const eyebrow = computed(() => {
    const game = state.value;

    if (game?.dailyDate) {
        return 'Daily · full time';
    }

    return game?.objective ? 'Challenge · full time' : `${game?.formationCode ?? ''} · full time`;
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

    return game.tier ? TIER_COPY[game.tier].emoji : '';
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
        tone: outcome.value.tone === 'win' ? 'win' : outcome.value.tone === 'bust' ? 'bust' : undefined,
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

// Classic's quick replay: a fresh game on the same formation, one tap.
function handleSameFormation(): void {
    replaySameFormation();
}

function handlePickFormation(): void {
    trackEvent('view_formation_picker', { source: 'result' });
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
                :style="{ '--piece-color': piece.color, '--piece-drift': piece.drift, '--piece-left': piece.left, '--piece-rotate': piece.rotate, animationDelay: piece.delay }"
            />
        </div>

        <div v-if="outcome.tone === 'bust'" aria-hidden="true" class="result-panel__stamp">Bust</div>
        <div v-else-if="outcome.tone === 'win'" aria-hidden="true" class="result-panel__stamp result-panel__stamp--win">Exact</div>

        <div class="result-panel__head">
            <p class="result-panel__eyebrow">{{ eyebrow }}</p>
            <h2 class="result-panel__headline">{{ outcome.label }}</h2>
            <p class="result-panel__detail">{{ outcome.detail }}</p>
        </div>

        <dl class="result-panel__stats">
            <div v-for="stat in resultStats" :key="stat.label" class="result-panel__stat" :class="{ 'result-panel__stat--total': stat.label === 'Total' }">
                <dt>{{ stat.label }}</dt>
                <dd>{{ stat.value }}</dd>
            </div>
        </dl>

        <ol v-if="ladder.length > 0" aria-label="Finishing places" class="result-panel__ladder">
            <li
                v-for="rung in ladder"
                :key="rung.key"
                :aria-current="rung.hit ? 'true' : undefined"
                class="result-panel__rung"
                :class="[`result-panel__rung--${rung.tone}`, { 'result-panel__rung--hit': rung.hit }]"
            >
                <span class="result-panel__rung-label">{{ rung.label }}</span>
                <span class="result-panel__rung-range">{{ rung.range }}</span>
            </li>
        </ol>

        <div v-if="!state.objective" class="result-panel__actions">
            <button class="result-panel__action result-panel__action--primary result-panel__action--wide" type="button" @click="handleSameFormation">
                Same formation again
            </button>
            <NuxtLink class="result-panel__action" to="/select-formation" @click="handlePickFormation">Pick a formation</NuxtLink>
            <button class="result-panel__action result-panel__action--secondary" type="button" @click="handleShareImage">
                {{ shareImageLabel }}
            </button>
        </div>

        <div v-else class="result-panel__actions">
            <button class="result-panel__action result-panel__action--primary" type="button" @click="handlePlayAgain">
                Play again
            </button>
            <button class="result-panel__action result-panel__action--secondary" type="button" @click="handleShareImage">
                {{ shareImageLabel }}
            </button>
        </div>

        <div class="result-panel__share">
            <code class="result-panel__share-text">{{ shareText }}</code>
            <button class="result-panel__share-copy" type="button" @click="handleCopy">
                {{ copied ? 'Copied!' : 'Copy' }}
            </button>
        </div>

        <div v-if="starSlot" class="result-panel__starman">
            <svg aria-hidden="true" class="result-panel__starman-icon" fill="currentColor" height="24" viewBox="0 0 24 24" width="24">
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

// "Bib & Board" full-time card (the handbook's result mockup). Mobile-first,
// filling whatever width its parent page column provides. position:
// relative + overflow: hidden so the confetti and stamps clip cleanly to
// the card's rounded corners. --tone is the outcome's colour, from the --tier-* ladder in app.vue:
// exact win = bib red (the one red moment), CL green -> EL teal -> mid-table
// slate -> avoided amber -> relegated muted; a bust is slate (never red),
// and a daily "not quite" sits with the muted end.
.result-panel {
    --tone: var(--color-foreground);

    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-sm);
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow: hidden;
    padding: 1.25rem;
    position: relative;
    width: 100%;
}

.result-panel--win {
    --tone: var(--color-bib);

    animation: result-panel-win-pop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
    background-color: color-mix(in srgb, var(--color-bib) 6%, var(--color-surface));
    border-color: color-mix(in srgb, var(--color-bib) 45%, transparent);
}

.result-panel--title-winners {
    --tone: var(--tier-title);
}

.result-panel--champions-league {
    --tone: var(--tier-cl);
}

.result-panel--europa-league {
    --tone: var(--tier-el);
}

.result-panel--mid-table {
    --tone: var(--tier-mid);
}

.result-panel--avoided-relegation {
    --tone: var(--tier-avoided);
}

.result-panel--relegated,
.result-panel--lost {
    --tone: var(--tier-relegated);
}

.result-panel--bust {
    --tone: var(--color-bust);

    animation: result-panel-bust-shake 0.4s ease-out;
}

@keyframes result-panel-win-pop {
    0% {
        transform: scale(0.96);
    }

    100% {
        transform: scale(1);
    }
}

@keyframes result-panel-bust-shake {
    0%,
    100% {
        transform: translateX(0);
    }

    25% {
        transform: translateX(-5px);
    }

    50% {
        transform: translateX(4px);
    }

    75% {
        transform: translateX(-2px);
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
    animation: result-panel-confetti-fall 1.2s cubic-bezier(0.2, 0.6, 0.4, 1) forwards;
    background: var(--piece-color);
    border-radius: 1px;
    height: 10px;
    left: var(--piece-left);
    opacity: 0;
    position: absolute;
    top: -12px;
    width: 6px;
}

@keyframes result-panel-confetti-fall {
    0% {
        opacity: 1;
        transform: translate(0, 0) rotate(var(--piece-rotate));
    }

    80% {
        opacity: 1;
    }

    100% {
        opacity: 0;
        transform: translate(var(--piece-drift), 220px) rotate(calc(var(--piece-rotate) + 240deg));
    }
}

.result-panel__stamp {
    animation: result-panel-stamp-down 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
    border: 2px solid var(--tone);
    border-radius: var(--radius-sm);
    color: var(--tone);
    font-family: var(--font-display);
    font-size: 1.3rem;
    font-weight: 900;
    letter-spacing: 0.1em;
    padding: 0.1rem 0.75rem;
    pointer-events: none;
    position: absolute;
    right: 1rem;
    text-transform: var(--display-text-transform);
    top: 1rem;
    transform: rotate(-8deg);
    z-index: 1;
}

.result-panel__stamp--win {
    background-color: var(--color-bib);
    color: var(--color-on-bib);
}

@keyframes result-panel-stamp-down {
    0% {
        opacity: 0;
        transform: rotate(-8deg) scale(2);
    }

    60% {
        opacity: 1;
    }

    100% {
        opacity: 1;
        transform: rotate(-8deg) scale(1);
    }
}

@media (prefers-reduced-motion: reduce) {
    .result-panel--win,
    .result-panel--bust,
    .result-panel__stamp {
        animation: none;
    }

    .result-panel__confetti {
        display: none;
    }
}

.result-panel__head {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
}

// Keeps the headline clear of the corner stamp on the two outcomes that
// have one.
.result-panel--win .result-panel__head,
.result-panel--bust .result-panel__head {
    padding-right: 5.5rem;
}

.result-panel__eyebrow {
    color: var(--color-muted);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    margin: 0;
    text-transform: uppercase;
}

.result-panel__headline {
    color: var(--tone);
    font-size: 2.25rem;
    font-weight: 900;
    margin: 0;
}

.result-panel__detail {
    color: var(--color-muted);
    margin: 0;
}

// The numbers as a hairline-split strip, like the in-game ScoreBar; Total
// is the big one and takes the outcome's tone.
.result-panel__stats {
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    display: flex;
    margin: 0;
    overflow: hidden;
}

.result-panel__stat {
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 0;
    padding: 0.6rem 0.85rem;
}

.result-panel__stat + .result-panel__stat {
    border-left: 1px solid var(--color-line);
}

.result-panel__stat dt {
    color: var(--color-muted);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}

.result-panel__stat dd {
    font-family: var(--font-display);
    font-size: 1.75rem;
    font-variant-numeric: tabular-nums;
    font-weight: 900;
    line-height: 1;
    margin: 0;
}

.result-panel__stat--total dd {
    color: var(--tone);
}

// The finishing-places ladder: quiet hairline rungs, with the one this game
// reached tinted in its tier colour (text stays ink, so contrast holds for
// every tier in both themes — only the exact rung goes solid red).
.result-panel__ladder {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    list-style: none;
    margin: 0;
    padding: 0;
}

.result-panel__rung {
    --rung-tone: var(--color-muted);

    align-items: center;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    color: var(--color-muted);
    display: flex;
    font-size: 0.85rem;
    font-weight: 700;
    gap: 0.75rem;
    justify-content: space-between;
    padding: 0.45rem 0.75rem;
}

.result-panel__rung--win {
    --rung-tone: var(--color-bib);
}

.result-panel__rung--title-winners {
    --rung-tone: var(--tier-title);
}

.result-panel__rung--champions-league {
    --rung-tone: var(--tier-cl);
}

.result-panel__rung--europa-league {
    --rung-tone: var(--tier-el);
}

.result-panel__rung--mid-table {
    --rung-tone: var(--tier-mid);
}

.result-panel__rung--avoided-relegation {
    --rung-tone: var(--tier-avoided);
}

.result-panel__rung--relegated {
    --rung-tone: var(--tier-relegated);
}

.result-panel__rung-label {
    align-items: center;
    display: flex;
    gap: 0.5rem;
}

.result-panel__rung-label::before {
    background-color: var(--rung-tone);
    border-radius: 50%;
    content: '';
    flex-shrink: 0;
    height: 0.5rem;
    width: 0.5rem;
}

.result-panel__rung-range {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 500;
}

.result-panel__rung--hit {
    background-color: color-mix(in srgb, var(--rung-tone) 16%, var(--color-surface));
    border-color: var(--rung-tone);
    color: var(--color-foreground);
}

.result-panel__rung--win.result-panel__rung--hit {
    background-color: var(--color-bib);
    color: var(--color-on-bib);
}

.result-panel__rung--win.result-panel__rung--hit .result-panel__rung-label::before {
    background-color: var(--color-on-bib);
}

.result-panel__actions {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: 1fr 1fr;
}

.result-panel__action {
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
    justify-content: center;
    min-height: var(--tap-min);
    padding: 0.6rem 1rem;
    text-align: center;
    text-decoration: none;
    transition: border-color 0.15s ease, transform 0.15s ease;
}

.result-panel__action:hover {
    border-color: var(--color-primary);
}

.result-panel__action:active {
    transform: scale(0.98);
}

// Same formation again (Classic) / Play again is the screen's one main call
// to action, so it's the bib-red button; Share image is the secondary green
// one; Pick a formation is a quiet ghost beside it.
.result-panel__action--primary {
    background-color: var(--color-bib);
    border-color: var(--color-bib);
    color: var(--color-on-bib);
}

.result-panel__action--secondary {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-on-primary);
}

.result-panel__action--primary:hover,
.result-panel__action--secondary:hover {
    border-color: var(--color-foreground);
}

.result-panel__action--wide {
    grid-column: 1 / -1;
}

@media (prefers-reduced-motion: reduce) {
    .result-panel__action {
        transition: none;
    }

    .result-panel__action:active {
        transform: none;
    }
}

.result-panel__share {
    align-items: center;
    background-color: var(--color-surface-2);
    border-radius: var(--radius-md);
    display: flex;
    gap: 0.75rem;
    justify-content: space-between;
    padding: 0.3rem 0.3rem 0.3rem 0.85rem;
}

.result-panel__share-text {
    color: var(--color-muted);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.result-panel__share-copy {
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-sm);
    color: var(--color-foreground);
    cursor: pointer;
    flex-shrink: 0;
    font: inherit;
    font-size: 0.8rem;
    font-weight: 700;
    min-height: var(--tap-min);
    min-width: 4.5rem;
    padding: 0 0.85rem;
}

.result-panel__share-copy:hover {
    border-color: var(--color-primary);
}

// The top contributor pulled out of the list as its own moment — a captain-
// style highlight, so its star and number are bib red.
.result-panel__starman {
    align-items: center;
    background-color: var(--color-surface-2);
    border-radius: var(--radius-md);
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem 0.9rem;
}

.result-panel__starman-icon {
    color: var(--color-bib);
    flex-shrink: 0;
}

.result-panel__starman-info {
    flex-grow: 1;
    min-width: 0;
}

.result-panel__starman-label {
    color: var(--color-muted);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    margin: 0;
    text-transform: uppercase;
}

.result-panel__starman-name {
    font-family: var(--font-display);
    font-size: 1.35rem;
    font-weight: 800;
    line-height: 1.05;
    margin: 0.1rem 0 0;
    overflow: hidden;
    text-overflow: ellipsis;
    text-transform: var(--display-text-transform);
    white-space: nowrap;
}

.result-panel__starman-caption {
    color: var(--color-muted);
    font-size: 0.75rem;
    margin: 0.1rem 0 0;
}

.result-panel__starman-total {
    align-items: center;
    background-color: var(--color-bib);
    border-radius: 50%;
    color: var(--color-on-bib);
    display: flex;
    flex-shrink: 0;
    font-family: var(--font-mono);
    font-size: 1rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    height: 2.75rem;
    justify-content: center;
    width: 2.75rem;
}

// The rest of the XI: one line each, quiet next to the spotlight above —
// role as a small mono tag, the g/a breakdown compact before the tally.
.result-panel__recap {
    display: flex;
    flex-direction: column;
    list-style: none;
    margin: 0;
    padding: 0;
}

.result-panel__recap-item {
    align-items: center;
    display: flex;
    gap: 0.6rem;
    padding: 0.45rem 0;
}

.result-panel__recap-item + .result-panel__recap-item {
    border-top: 1px solid var(--color-line);
}

.result-panel__recap-role {
    color: var(--color-muted);
    flex-shrink: 0;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 600;
    min-width: 2.25rem;
}

.result-panel__recap-name {
    flex-grow: 1;
    font-size: 0.875rem;
    font-weight: 600;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.result-panel__recap-caption {
    color: var(--color-muted);
    flex-shrink: 0;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    white-space: nowrap;
}

.result-panel__recap-total {
    flex-shrink: 0;
    font-family: var(--font-mono);
    font-size: 0.875rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    min-width: 1.75rem;
    text-align: right;
}
</style>
