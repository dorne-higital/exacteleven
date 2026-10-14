<script setup lang="ts">
import type { DrawnPlayer, PositionGroup } from '../../shared/types';
import { gameMode } from '../composables/useGame';
import { trackEvent } from '../utils/analytics';
import { describeSlotRole } from '../utils/formations';
import { isAppBuild } from '../utils/platform';
import { powerUpButton, powerUpNote } from '../utils/power-ups';
import type { PowerUpKind } from '../utils/power-ups';
import { classifyReveal, pickFlavorLine } from '../utils/reveal-flavor';

const { state, isDrawing, pickPlayer, useReroll, useHint, closeDialog, canReroll, canHint } = useGame();
const { boostBank } = usePurchases();
const { openShop } = useShop();

const candidates = computed(() => state.value?.offeredPlayers ?? []);

// Reroll / Hint button copy and behaviour from useGame's canReroll/canHint:
// the free one, then (app only, never the Daily) Pro, a banked boost, or a
// "Get boosts" button into the shop — see utils/power-ups.ts.
const mode = computed(() => (state.value ? gameMode(state.value) : null));
const rerollButton = computed(() => powerUpButton('reroll', canReroll.value, boostBank.value));
const hintButton = computed(() => powerUpButton('hint', canHint.value, boostBank.value));
const powerUpHelp = computed(() => powerUpNote(mode.value, isAppBuild(), canReroll.value, canHint.value));

// boost_bank_empty: once per sheet per kind, the first time a button turns
// into "Get boosts" (the empty-bank prompt the shop funnel starts from).
const emptyBankLogged = new Set<PowerUpKind>();

watch([() => rerollButton.value.action, () => hintButton.value.action], ([reroll, hint]) => {
    for (const [kind, action] of [['reroll', reroll], ['hint', hint]] as const) {
        if (action === 'shop' && !emptyBankLogged.has(kind)) {
            emptyBankLogged.add(kind);
            trackEvent('boost_bank_empty', { boost_kind: kind, mode: mode.value });
        }
    }
}, { immediate: true });
// Which currently-offered candidate the last hint ruled out, if any. Lives
// in the game state per slot (useGame clears it whenever that slot gets a
// new draw, since a stale hint is meaningless once the options change), so
// closing and reopening the slot still shows it.
const ruledOutId = computed(() => {
    const game = state.value;

    return game?.activeSlotId ? game.ruledOutBySlot?.[game.activeSlotId] ?? null : null;
});

// Player data only tracks the broad GK/DEF/MID/FWD group, not real-world
// sub-positions — so a "right-back" slot can just as easily offer a
// left-back or a natural centre-back. The tactical short labels look good
// and stay, but this makes that scope honest instead of silently implied.
const POSITION_NOUNS: Record<PositionGroup, string> = {
    GK: 'goalkeeper',
    DEF: 'defender',
    MID: 'midfielder',
    FWD: 'forward',
};

const activeSlot = computed(() => state.value?.slots.find((slot) => slot.id === state.value?.activeSlotId) ?? null);

// The sheet's heading names the slot being filled ("Left-back"), like the
// handbook's pick mockup, under a small "Pick a player" eyebrow.
const slotTitle = computed(() => (
    activeSlot.value ? describeSlotRole(activeSlot.value.group, activeSlot.value.side, activeSlot.value.rowSize) : ''
));

// "52 to go" — how far the running total is from the target. Only for the
// classic game and the daily 'exact' objective; the other objective kinds
// have no single number to count down to.
const toGo = computed(() => {
    const game = state.value;

    if (!game || (game.objective && game.objective.kind !== 'exact')) {
        return null;
    }

    return Math.max(0, (game.objective?.value ?? game.target) - game.total);
});

const positionScopeNote = computed(() => {
    const group = activeSlot.value?.group;
    const noun = group ? POSITION_NOUNS[group] : 'player';
    const base = `Any real ${noun} can turn up here — not narrowed to this exact tactical slot.`;

    // Goals+assists is the scoring stat for every slot, but goalkeepers
    // rarely register either — most of the pool reveals close to zero
    // regardless of which one gets picked. Called out so that reads as a
    // deliberate low-stakes slot rather than a broken or boring one.
    return group === 'GK' ? `${base} Goalkeepers rarely score or assist, so this pick is usually low-stakes.` : base;
});

const dialogRef = ref<HTMLDialogElement | null>(null);
const titleId = useId();
const revealing = ref(false);
const showResult = ref(false);
const revealedName = ref('');
const displayValue = ref(0);
const srAnnouncement = ref('');
const pickError = ref(false);
// A distinct, blame-free variant of pickError — the anti-peek token expired
// because the player sat on this pick too long, not because anything broke.
const pickTimedOut = ref(false);
// A short, non-essential flavor line for a notable reveal (bust/win/cutting
// it fine) — null on a routine pick, so most reveals stay quick and quiet.
const revealFlavor = ref<string | null>(null);
// Which candidate the player actually tapped — every option shares the same
// aria-disabled condition while a pick is revealing, so without this all
// three dim identically and there's no visual confirmation of which one was
// chosen during the round trip.
const pickedId = ref<string | null>(null);

// Purely decorative "reel" text shown in place of each candidate's real name
// and club/era line for a moment before they settle — the real data is
// already in hand from the draw, this is just how it gets revealed. Club
// names are obviously fictional, same spirit as the filler surnames, so
// nobody mistakes either for real information mid-scramble.
const FILLER_SURNAMES = [
    'Whitfield', 'Bergqvist', 'Okafor', 'Marchetti', 'Ivanov',
    'Delacroix', 'Haraldsson', 'Kowalczyk', 'Nakashima', 'Ferreira',
];

const FILLER_CLUBS = [
    'Ashford Rovers', 'Kestrel Town', 'Marlowe Athletic', 'Redgate United',
    'Fenbridge City', 'Harrow Vale', 'Thornfield Wanderers', 'Quarrymoor FC',
];

function randomFiller(pool: string[]): string {
    return pool[Math.floor(Math.random() * pool.length)] ?? '';
}

const displayNames = ref<string[]>([]);
const displayMeta = ref<string[]>([]);
const settled = ref<boolean[]>([]);
const isScrambling = computed(() => settled.value.some((flag) => !flag));

// showModal() autofocuses the first option while it's still scrambling, so a
// screen reader user's first announcement is the placeholder "Loading
// option" label with nothing telling them when the real names land — this
// fires that missing announcement once, the moment every option has settled.
watch(isScrambling, (scrambling, wasScrambling) => {
    if (wasScrambling && !scrambling) {
        srAnnouncement.value = 'Players ready';
    }
});

const SCRAMBLE_TICK_MS = 60;

let scrambleFrame: number | null = null;

function stopScramble(): void {
    if (scrambleFrame !== null) {
        window.cancelAnimationFrame(scrambleFrame);
        scrambleFrame = null;
    }
}

// Kicks off the reel effect for a freshly-drawn set of candidates — called on
// both the initial draw and after a reroll. Each option settles on its real
// name one after another, like slot-machine reels landing. Skipped entirely
// under reduced motion, matching animateCountUp's approach below. Driven by
// one requestAnimationFrame loop covering every candidate, rather than a
// per-candidate setInterval + setTimeout pair (up to 6 live timers for a
// 3-item list) — same visual result, far less timer/reactivity churn.
function startScramble(items: DrawnPlayer[]): void {
    stopScramble();

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
        displayNames.value = items.map((item) => item.name);
        displayMeta.value = items.map((item) => eraLabel(item));
        settled.value = items.map(() => true);

        return;
    }

    displayNames.value = items.map(() => randomFiller(FILLER_SURNAMES));
    displayMeta.value = items.map(() => randomFiller(FILLER_CLUBS));
    settled.value = items.map(() => false);

    const start = performance.now();
    const settleAt = items.map((_, index) => 500 + index * 150);
    const lastTickAt = items.map(() => 0);

    function tick(now: number): void {
        const elapsed = now - start;
        let stillScrambling = false;

        items.forEach((item, index) => {
            if (settled.value[index]) {
                return;
            }

            if (elapsed >= settleAt[index]!) {
                displayNames.value[index] = item.name;
                displayMeta.value[index] = eraLabel(item);
                settled.value[index] = true;

                return;
            }

            stillScrambling = true;

            if (elapsed - lastTickAt[index]! >= SCRAMBLE_TICK_MS) {
                displayNames.value[index] = randomFiller(FILLER_SURNAMES);
                displayMeta.value[index] = randomFiller(FILLER_CLUBS);
                lastTickAt[index] = elapsed;
            }
        });

        scrambleFrame = stillScrambling ? window.requestAnimationFrame(tick) : null;
    }

    scrambleFrame = window.requestAnimationFrame(tick);
}

watch(candidates, (items) => {
    if (items.length > 0) {
        startScramble(items);
        pickedId.value = null;
    }
}, { immediate: true });

onUnmounted(() => {
    stopScramble();
});

onMounted(() => {
    dialogRef.value?.showModal();
});

function eraLabel(candidate: DrawnPlayer): string {
    return `${candidate.clubs.join(', ')} · ${candidate.firstSeason}-${candidate.lastSeason}`;
}

function animateCountUp(target: number): Promise<void> {
    return new Promise((resolve) => {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (reduceMotion || target <= 0) {
            displayValue.value = target;
            resolve();

            return;
        }

        const durationMs = 700;
        const start = performance.now();

        function tick(now: number): void {
            const progress = Math.min(1, (now - start) / durationMs);

            displayValue.value = Math.round(target * progress);

            if (progress < 1) {
                requestAnimationFrame(tick);
            } else {
                resolve();
            }
        }

        requestAnimationFrame(tick);
    });
}

async function handlePick(candidate: DrawnPlayer): Promise<void> {
    if (revealing.value || isDrawing.value || isScrambling.value) {
        return;
    }

    revealing.value = true;
    revealedName.value = candidate.name;
    displayValue.value = 0;
    pickError.value = false;
    pickTimedOut.value = false;
    pickedId.value = candidate.id;
    revealFlavor.value = null;

    const result = await pickPlayer(candidate);

    if (result === 'timeout') {
        revealing.value = false;
        pickTimedOut.value = true;
        pickedId.value = null;

        return;
    }

    if (!result) {
        revealing.value = false;
        pickError.value = true;
        pickedId.value = null;

        return;
    }

    showResult.value = true;
    await animateCountUp(result.goals + result.assists);

    // Announced once, after the count-up settles, rather than relying on the
    // rapidly-changing visible number (which is aria-hidden below) or on
    // ScoreBar's Total — that field sits outside this modal dialog and is
    // inert, so screen readers never see it change while this is open.
    const total = state.value?.total ?? 0;
    const objective = state.value?.objective;

    // The classic game and the daily 'exact' objective both frame this as
    // "total vs. a target"; the other daily objectives (over/under/allUnder)
    // don't have a single target number to compare against here — ScoreBar
    // and ResultPanel already carry that context, so this just states the
    // running total.
    srAnnouncement.value = (!objective || objective.kind === 'exact')
        ? `${revealedName.value}: ${result.goals + result.assists}. Running total ${total} of target ${objective?.value ?? state.value?.target ?? 0}.`
        : `${revealedName.value}: ${result.goals + result.assists}. Running total ${total}.`;

    // Distance from whatever's just been revealed to the relevant ceiling,
    // unified across every objective kind (see reveal-flavor.ts) — 'over'
    // has no ceiling, so it's never eligible for a "cutting it fine" line.
    const marginToLimit = (() => {
        if (!objective) {
            return (state.value?.target ?? 0) - total;
        }

        if (objective.kind === 'exact' || objective.kind === 'under') {
            return objective.value - total;
        }

        if (objective.kind === 'allUnder') {
            return objective.value - (result.goals + result.assists);
        }

        return null;
    })();

    const mood = classifyReveal(state.value?.status ?? 'playing', marginToLimit);

    revealFlavor.value = mood ? pickFlavorLine(mood) : null;

    if (revealFlavor.value) {
        srAnnouncement.value += ` ${revealFlavor.value}`;
    }

    window.setTimeout(() => {
        dialogRef.value?.close();
    }, revealFlavor.value ? 1100 : 500);
}

// Spins the dice icon for the duration of the reroll's network round trip.
// Tied to isDrawing rather than isScrambling: drawForSlot() (which useReroll
// calls) leaves offeredPlayers untouched on a failed fetch, so the
// candidates watcher below never re-fires and isScrambling never flips —
// isDrawing always resolves to false exactly once, success or not.
const rerollSpinning = ref(false);

watch(isDrawing, (drawing) => {
    if (!drawing) {
        rerollSpinning.value = false;
    }
});

async function handleReroll(): Promise<void> {
    // useReroll() itself also no-ops when nothing's left, but aria-disabled
    // (unlike the native disabled attribute) doesn't block the click at the
    // DOM level, so check here too for a clean fast path.
    if (revealing.value || isDrawing.value || isScrambling.value || rerollButton.value.action === 'none') {
        return;
    }

    if (rerollButton.value.action === 'shop') {
        openShop('reroll_button');

        return;
    }

    pickError.value = false;
    pickTimedOut.value = false;
    rerollSpinning.value = true;
    await useReroll();
}

const hintLoading = ref(false);

async function handleHint(): Promise<void> {
    // Also blocks a second tap once a hint is already showing for
    // these exact candidates — re-asking would just spend a hint to learn
    // the same answer again.
    if (revealing.value || isDrawing.value || isScrambling.value || hintButton.value.action === 'none' || ruledOutId.value) {
        return;
    }

    if (hintButton.value.action === 'shop') {
        openShop('hint_button');

        return;
    }

    hintLoading.value = true;

    try {
        await useHint();
    } finally {
        hintLoading.value = false;
    }
}

// Fires on Escape as well as our own programmatic close() above — either way,
// clear the shared game state so play.vue stops rendering this dialog and
// (per the native <dialog> contract) focus returns to the slot that opened it.
// closeDialog() keeps this slot's candidates, so tapping it again reopens
// the same options rather than drawing new ones for free.
function handleNativeClose(): void {
    closeDialog();
}

// A click that lands on the <dialog> element itself (not a descendant) means
// it hit the backdrop area, not the content — the native way to detect a
// click-outside on a <dialog>. Same close-but-keep-the-offer behavior Escape
// already triggers via handleNativeClose above.
function handleBackdropClick(event: MouseEvent): void {
    if (event.target === dialogRef.value) {
        dialogRef.value?.close();
    }
}
</script>

<template>
    <dialog ref="dialogRef" :aria-labelledby="titleId" class="player-choice" @click="handleBackdropClick" @close="handleNativeClose">
        <div aria-hidden="true" class="player-choice__handle" />

        <div class="player-choice__top">
            <h2 :id="titleId" class="player-choice__title">
                <span class="player-choice__eyebrow">Pick a player</span>
                <span v-if="slotTitle" class="player-choice__slot">{{ slotTitle }}</span>
            </h2>
            <span v-if="toGo !== null && !showResult" class="player-choice__to-go">
                <span class="player-choice__to-go-value">{{ toGo }}</span> to go
            </span>
        </div>

        <p aria-live="polite" class="player-choice__sr-announcement">{{ srAnnouncement }}</p>

        <p v-if="!showResult" class="player-choice__scope-note">{{ positionScopeNote }}</p>

        <ul v-if="!showResult" class="player-choice__list">
            <li v-for="(candidate, index) in candidates" :key="candidate.id">
                <button
                    class="player-choice__option"
                    :aria-disabled="revealing || isDrawing || isScrambling"
                    :aria-label="settled[index]
                        ? `${candidate.name} — ${eraLabel(candidate)}${ruledOutId === candidate.id ? ' — Hint: avoid' : ''}`
                        : 'Loading option'"
                    :class="{
                        'player-choice__option--picked': pickedId === candidate.id,
                        'player-choice__option--scrambling': !settled[index],
                        'player-choice__option--ruled-out': ruledOutId === candidate.id,
                    }"
                    type="button"
                    @click="handlePick(candidate)"
                >
                    <span aria-hidden="true" class="player-choice__name">{{ displayNames[index] }}</span>
                    <span aria-hidden="true" class="player-choice__meta">{{ displayMeta[index] }}</span>
                    <!-- The hidden stat: "??" until revealed, or the hint's verdict. -->
                    <span aria-hidden="true" class="player-choice__peek">{{ ruledOutId === candidate.id ? 'Avoid' : '??' }}</span>
                </button>
            </li>
        </ul>

        <p v-if="pickTimedOut && !showResult" aria-live="polite" class="player-choice__error">
            That pick timed out — tap the player again for a fresh one.
        </p>

        <p v-else-if="pickError && !showResult" aria-live="polite" class="player-choice__error">
            Couldn't reveal that pick — tap the player again to retry.
        </p>

        <div
            v-if="showResult"
            class="player-choice__result"
            :class="{
                'player-choice__result--won': state?.status === 'won',
                'player-choice__result--bust': state?.status === 'bust',
            }"
        >
            <p class="player-choice__result-name">{{ revealedName }}</p>
            <p aria-hidden="true" class="player-choice__result-value">{{ displayValue }}</p>
            <p v-if="revealFlavor" aria-hidden="true" class="player-choice__result-flavor">{{ revealFlavor }}</p>
        </div>

        <div v-if="!showResult" class="player-choice__actions">
            <button
                class="player-choice__reroll"
                :class="{ 'player-choice__reroll--rolling': rerollSpinning, 'player-choice__reroll--shop': rerollButton.action === 'shop' }"
                :aria-disabled="rerollButton.action === 'none' || revealing || isDrawing || isScrambling"
                type="button"
                @click="handleReroll"
            >
                <svg aria-hidden="true" class="player-choice__dice" fill="none" height="18" viewBox="0 0 24 24" width="18">
                    <rect height="18" rx="4" stroke="currentColor" stroke-width="2" width="18" x="3" y="3" />
                    <circle cx="8" cy="8" fill="currentColor" r="1.4" />
                    <circle cx="16" cy="8" fill="currentColor" r="1.4" />
                    <circle cx="12" cy="12" fill="currentColor" r="1.4" />
                    <circle cx="8" cy="16" fill="currentColor" r="1.4" />
                    <circle cx="16" cy="16" fill="currentColor" r="1.4" />
                </svg>
                {{ rerollButton.label }}
            </button>

            <button
                class="player-choice__hint"
                :class="{ 'player-choice__hint--loading': hintLoading, 'player-choice__hint--shop': hintButton.action === 'shop' }"
                :aria-disabled="hintButton.action === 'none' || revealing || isDrawing || isScrambling || !!ruledOutId"
                type="button"
                @click="handleHint"
            >
                <svg aria-hidden="true" class="player-choice__hint-icon" fill="none" height="18" viewBox="0 0 24 24" width="18">
                    <path
                        d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3 11.2c.6.4 1 1.1 1 1.8h4c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z"
                        stroke="currentColor"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                    />
                </svg>
                {{ hintButton.label }}
            </button>
        </div>

        <p v-if="!showResult && powerUpHelp" class="player-choice__power-note">{{ powerUpHelp }}</p>
    </dialog>
</template>

<style lang="scss" scoped>
// "Bib & Board" pick sheet (the handbook's pick mockup). Mobile-first bottom
// sheet: full-width, anchored to the bottom edge, slides up on open.
// `@starting-style` + `allow-discrete` animate the native <dialog>'s entry
// into the top layer — the standard way to transition a dialog's open state
// without giving up showModal()'s built-in focus trap.
.player-choice {
    background-color: var(--color-background);
    border: 1px solid var(--color-line);
    border-bottom: 0;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    box-shadow: var(--shadow-lg);
    box-sizing: border-box;
    color: var(--color-foreground);
    inset: auto 0 0;
    margin: 0;
    max-height: 85vh;
    max-height: 85dvh;
    max-width: 100%;
    overflow-y: auto;
    padding: 0.6rem calc(1rem + env(safe-area-inset-right, 0px)) calc(1.25rem + env(safe-area-inset-bottom, 0px)) calc(1rem + env(safe-area-inset-left, 0px));
    position: fixed;
    transform: translateY(0);
    transition: transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), overlay 0.28s ease allow-discrete, display 0.28s ease allow-discrete;
    width: 100%;
}

@starting-style {
    .player-choice[open] {
        transform: translateY(100%);
    }
}

// Above phone width: a centered, width-capped panel rather than an
// edge-to-edge sheet stretched across a wide viewport — still bottom-anchored
// and still slides up, just reads as a deliberate panel.
@media (width >= 640px) {
    .player-choice {
        border-bottom: 1px solid var(--color-line);
        border-radius: var(--radius-lg);
        bottom: 2rem;
        left: 50%;
        max-width: 26rem;
        padding: 1.25rem;
        right: auto;
        transform: translateX(-50%) translateY(0);
        width: calc(100% - 4rem);
    }

    @starting-style {
        .player-choice[open] {
            transform: translateX(-50%) translateY(120%);
        }
    }
}

@media (prefers-reduced-motion: reduce) {
    .player-choice {
        transition: none;
    }
}

// The scrim is a translucent --color-primary-strong (deep pitch green), not
// plain black — color-mix keeps it token-driven.
.player-choice::backdrop {
    background-color: color-mix(in srgb, var(--color-primary-strong) 55%, transparent);
    transition: overlay 0.28s ease allow-discrete, display 0.28s ease allow-discrete, opacity 0.28s ease;
}

.player-choice[open]::backdrop {
    opacity: 1;
}

@starting-style {
    .player-choice[open]::backdrop {
        opacity: 0;
    }
}

@media (prefers-reduced-motion: reduce) {
    .player-choice::backdrop {
        transition: none;
    }
}

.player-choice__handle {
    background-color: var(--color-line);
    border-radius: var(--radius-pill);
    height: 0.3rem;
    margin: 0 auto 0.75rem;
    width: 2.5rem;
}

@media (width >= 640px) {
    .player-choice__handle {
        display: none;
    }
}

.player-choice__top {
    align-items: flex-end;
    display: flex;
    gap: 0.75rem;
    justify-content: space-between;
    margin-bottom: 0.4rem;
}

.player-choice__title {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    margin: 0;
    min-width: 0;
}

.player-choice__eyebrow {
    color: var(--color-muted);
    font-family: var(--font-body);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.1em;
}

.player-choice__slot {
    font-size: 1.75rem;
    font-weight: 900;
    line-height: 1;
}

.player-choice__to-go {
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-pill);
    color: var(--color-muted);
    flex-shrink: 0;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.3rem 0.7rem;
    white-space: nowrap;
}

.player-choice__to-go-value {
    color: var(--color-foreground);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
}

// Visually hidden but always present (not v-if'd) so screen readers pick up
// its text changes reliably — an element that appears for the first time
// with aria-live already set is inconsistently announced across AT.
.player-choice__sr-announcement {
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

.player-choice__scope-note {
    color: var(--color-muted);
    font-size: 0.75rem;
    margin: 0 0 0.85rem;
}

// Errors are amber, not red — red is reserved for celebration and the CTA.
.player-choice__error {
    background-color: color-mix(in srgb, var(--color-amber) 12%, var(--color-surface));
    border: 1px solid color-mix(in srgb, var(--color-amber) 40%, transparent);
    border-radius: var(--radius-md);
    color: var(--color-foreground);
    font-size: 0.85rem;
    font-weight: 600;
    margin: 0.75rem 0 0;
    padding: 0.6rem 0.75rem;
}

.player-choice__list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    list-style: none;
    margin: 0;
    padding: 0;
}

// A card per candidate: name over club/era on the left, the hidden stat
// ("??") as a mono tile on the right.
.player-choice__option {
    align-items: center;
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-sm);
    color: inherit;
    cursor: pointer;
    display: grid;
    font: inherit;
    gap: 0.1rem 0.75rem;
    grid-template-columns: 1fr auto;
    min-height: 3.75rem;
    padding: 0.65rem 0.7rem 0.65rem 1rem;
    text-align: left;
    transition: border-color 0.15s ease, transform 0.15s ease;
    width: 100%;
}

.player-choice__option:not([aria-disabled='true']):active {
    transform: scale(0.985);
}

// aria-disabled, not the native disabled attribute: disabled would blur the
// button the instant a pick starts revealing, which happens well before the
// dialog actually closes — breaking <dialog>'s native restore-focus-on-close
// behavior (it only restores focus if focus is still inside the dialog at
// close time). Staying focusable keeps that native behavior intact.
.player-choice__option[aria-disabled='true'] {
    cursor: default;
    opacity: 0.55;
    pointer-events: none;
}

.player-choice__option:not([aria-disabled='true']):hover,
.player-choice__option:not([aria-disabled='true']):focus-visible {
    border-color: var(--color-primary);
}

// The option the player tapped is the active state — bib red — so it stays
// visually confirmed rather than fading identically to the two they didn't
// choose.
.player-choice__option--picked[aria-disabled='true'] {
    background-color: color-mix(in srgb, var(--color-bib) 8%, var(--color-surface));
    border-color: var(--color-bib);
    opacity: 1;
}

.player-choice__name {
    font-size: 1rem;
    font-weight: 700;
    grid-column: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.player-choice__option--scrambling .player-choice__name,
.player-choice__option--scrambling .player-choice__meta {
    color: var(--color-muted);
}

.player-choice__meta {
    color: var(--color-muted);
    font-size: 0.75rem;
    grid-column: 1;
    min-width: 0;
}

.player-choice__peek {
    align-items: center;
    background-color: var(--color-surface-2);
    border-radius: var(--radius-md);
    color: var(--color-muted);
    display: flex;
    font-family: var(--font-mono);
    font-size: 1.05rem;
    font-weight: 700;
    grid-column: 2;
    grid-row: 1 / span 2;
    height: 2.5rem;
    justify-content: center;
    min-width: 3rem;
    padding: 0 0.4rem;
}

.player-choice__option--picked .player-choice__peek {
    background-color: var(--color-bib);
    color: var(--color-on-bib);
}

// Whichever option a hint ruled out: an amber warning (not red — that's
// celebratory here), the tile reading "Avoid" so the reason is explicit, not
// just an unexplained colour change. Still fully pickable: it's advice.
.player-choice__option--ruled-out {
    border-color: color-mix(in srgb, var(--color-amber) 60%, transparent);
}

.player-choice__option--ruled-out .player-choice__peek {
    background-color: color-mix(in srgb, var(--color-amber) 22%, var(--color-surface));
    color: var(--color-foreground);
    font-family: var(--font-body);
    font-size: 0.7rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}

.player-choice__result {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 1.25rem 0 0.75rem;
}

.player-choice__result-name {
    font-size: 1rem;
    font-weight: 700;
    margin: 0;
}

.player-choice__result-value {
    font-family: var(--font-display);
    font-size: 4rem;
    font-variant-numeric: tabular-nums;
    font-weight: 900;
    line-height: 1;
    margin: 0;
}

// The pick that lands the target exactly is the red moment; one that goes
// over is slate, never red.
.player-choice__result--won .player-choice__result-value {
    color: var(--color-bib);
}

.player-choice__result--bust .player-choice__result-value {
    color: var(--color-bust);
}

.player-choice__result-flavor {
    color: var(--color-muted);
    font-size: 0.85rem;
    margin: 0;
    text-align: center;
}

.player-choice__actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
}

// Quiet ghost buttons (white surface, hairline) — the sheet's real action is
// tapping a player. flex: 1 1 0 splits the row evenly between Reroll and Hint.
.player-choice__reroll,
.player-choice__hint {
    align-items: center;
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    color: var(--color-foreground);
    cursor: pointer;
    display: flex;
    flex: 1 1 0;
    font: inherit;
    font-size: 0.82rem;
    font-weight: 700;
    gap: 0.4rem;
    justify-content: center;
    min-height: var(--tap-min);
    padding: 0.5rem 0.6rem;
    text-align: center;
    transition: border-color 0.15s ease;
}

.player-choice__reroll:hover,
.player-choice__reroll:focus-visible,
.player-choice__hint:hover,
.player-choice__hint:focus-visible {
    border-color: var(--color-primary);
}

.player-choice__reroll[aria-disabled='true'],
.player-choice__hint[aria-disabled='true'] {
    cursor: default;
    opacity: 0.5;
    pointer-events: none;
}

.player-choice__dice,
.player-choice__hint-icon {
    color: var(--color-primary);
    flex-shrink: 0;
}

// "Get boosts" (app only): still a quiet button — picking a player stays the
// sheet's main action — but in pitch green so it reads as a way forward
// rather than a spent counter.
.player-choice__reroll--shop,
.player-choice__hint--shop {
    border-color: color-mix(in srgb, var(--color-primary) 45%, transparent);
    color: var(--color-primary);
}

.player-choice__power-note {
    color: var(--color-muted);
    font-size: 0.75rem;
    margin: 0.5rem 0 0;
    text-align: center;
}

// A full tumble (spin + a punch of scale at the midpoint) while a reroll's
// request is in flight — the dice icon's one moment of real personality.
.player-choice__reroll--rolling .player-choice__dice {
    animation: player-choice-dice-roll 0.5s ease-in-out infinite;
}

@keyframes player-choice-dice-roll {
    0% {
        transform: rotate(0deg) scale(1);
    }

    50% {
        transform: rotate(180deg) scale(1.2);
    }

    100% {
        transform: rotate(360deg) scale(1);
    }
}

// A gentle pulse while a hint request is in flight — deliberately calmer
// than the dice tumble above, since this one's a lookup, not a re-roll.
.player-choice__hint--loading .player-choice__hint-icon {
    animation: player-choice-hint-pulse 0.8s ease-in-out infinite;
}

@keyframes player-choice-hint-pulse {
    0%,
    100% {
        opacity: 1;
    }

    50% {
        opacity: 0.3;
    }
}

@media (prefers-reduced-motion: reduce) {
    .player-choice__option {
        transition: none;
    }

    .player-choice__reroll--rolling .player-choice__dice,
    .player-choice__hint--loading .player-choice__hint-icon {
        animation: none;
    }
}
</style>
