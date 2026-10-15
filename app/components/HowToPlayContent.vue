<script setup lang="ts">
// Shared between the standalone /how-to-play route (direct-linkable) and the
// InfoDialog modal opened from AppHeader's info button — the modal is the
// primary way most people reach this, the route stays for direct links.
//
// Laid out as short, scannable sections rather than one long numbered list —
// most people read this on a phone, mid-game, looking for one specific rule.
import { DAILY_POINTS, DAILY_SCHEDULE } from '#shared/daily2-rules';
import { titleWindowFor } from '#shared/classic';
import { weekScheduleRows } from '../utils/daily-screens';
import { formations } from '../utils/formations';
import { TIER_BOUNDARIES } from '../utils/scoring';
import { TIER_COPY } from '../utils/tier-copy';

// The Title winners window scales with the target (1.5% of it), so its
// range is shown across every formation ("within 5–8").
const windows = formations.map((formation) => titleWindowFor(formation.target));
const titleRange = `within ${Math.min(...windows)}–${Math.max(...windows)}`;

// Built from scoring.ts's own boundaries so the ladder shown here can never
// drift from what the game actually awards.
const ladder = [
    { tier: 'titleWinners' as const, label: TIER_COPY.titleWinners.label, range: titleRange },
    ...TIER_BOUNDARIES.map((boundary, index) => ({
        tier: boundary.tier,
        label: TIER_COPY[boundary.tier].label,
        range: Number.isFinite(boundary.maxDistance)
            ? `within ${boundary.maxDistance}`
            : `over ${TIER_BOUNDARIES[index - 1]?.maxDistance ?? 0}`,
    })),
];

const schedule = weekScheduleRows(DAILY_SCHEDULE);

const points = [
    { label: 'Win', value: `${DAILY_POINTS.win.toLocaleString('en-GB')}, minus any help used` },
    { label: 'Reroll', value: `−${DAILY_POINTS.reroll}` },
    { label: 'Scouting clue', value: `−${DAILY_POINTS.clue}` },
    { label: 'Bench', value: `−${DAILY_POINTS.bench}` },
    { label: 'Miss', value: `up to ${DAILY_POINTS.missMax} by how close (never below ${DAILY_POINTS.missFloor})` },
    { label: 'Bust', value: `${DAILY_POINTS.bustPerSlot} per slot filled before it` },
];
</script>

<template>
    <div class="how-to-play-content">
        <section class="how-to-play-content__section">
            <h3 class="how-to-play-content__heading">The aim</h3>
            <div class="how-to-play-content__aim">
                <div aria-hidden="true" class="how-to-play-content__equation">
                    <span class="how-to-play-content__formation">4-4-2</span>
                    <span class="how-to-play-content__arrow">→</span>
                    <span class="how-to-play-content__target">442</span>
                </div>
                <p>
                    Pick a formation — its digits are your target. Build an XI whose career
                    <strong>goals + assists</strong> add up to <strong>exactly</strong> that number.
                </p>
            </div>
        </section>

        <section class="how-to-play-content__section">
            <h3 class="how-to-play-content__heading">Each pick</h3>
            <ol class="how-to-play-content__steps">
                <li><span><strong>Tap any empty slot</strong>, in any order.</span></li>
                <li><span><strong>Choose 1 of 3 real players</strong> for that position — their stats stay hidden.</span></li>
                <li><span><strong>See the reveal.</strong> Their goals + assists go on your running total.</span></li>
            </ol>
            <p class="how-to-play-content__note">
                Once a player's been offered, picked or not, they won't turn up again that game.
            </p>
        </section>

        <section class="how-to-play-content__section">
            <h3 class="how-to-play-content__heading">How it ends</h3>
            <ul class="how-to-play-content__outcomes">
                <li class="how-to-play-content__outcome how-to-play-content__outcome--win">
                    <span class="how-to-play-content__outcome-name">Exact hit</span>
                    <span><strong>Champion</strong> — the only true win.</span>
                </li>
                <li class="how-to-play-content__outcome how-to-play-content__outcome--bust">
                    <span class="how-to-play-content__outcome-name">Go over</span>
                    <span><strong>Bust</strong> — game over on the spot.</span>
                </li>
            </ul>
            <p class="how-to-play-content__note">
                Finish under the target and you land on the table instead. Title winners is a few off the
                target (1.5% of it), so it scales with the formation:
            </p>
            <ol class="how-to-play-content__ladder">
                <li
                    v-for="row in ladder"
                    :key="row.tier"
                    class="how-to-play-content__rung"
                    :class="`how-to-play-content__rung--${row.tier}`"
                >
                    <span>{{ row.label }}</span>
                    <span class="how-to-play-content__rung-range">{{ row.range }}</span>
                </li>
            </ol>
        </section>

        <section class="how-to-play-content__section">
            <h3 class="how-to-play-content__heading">Help, once per game</h3>
            <div class="how-to-play-content__helpers">
                <div class="how-to-play-content__helper">
                    <strong>Reroll</strong>
                    <p>Don't like the 3 options? Redraw them — on any one slot.</p>
                </div>
                <div class="how-to-play-content__helper">
                    <strong>Hint</strong>
                    <p>Rules out the riskiest of the 3. Locks once only 2 slots are left.</p>
                </div>
            </div>
        </section>

        <section class="how-to-play-content__section">
            <h3 class="how-to-play-content__heading">The Daily</h3>
            <p>
                <strong>Same options for everyone</strong>, new at midnight UK time. A few players start locked in;
                each other slot has 3 fixed options. Your first go each day counts for the table: you'll see
                what percentage of players you beat.
            </p>
            <ul class="how-to-play-content__daily-rules">
                <li><strong>Captain.</strong> Name one before your last pick: their number counts double. Name an empty slot for a blind captain, or a revealed player for safety. Once named, it's locked.</li>
                <li><strong>Bench.</strong> Once a game, take one of your players off for a mystery sub (same position, similar numbers). Use it straight after a bust to get back in it.</li>
                <li><strong>Scouting clue.</strong> Shows one option's range (0–10, 11–30, 31–60, 61–100 or 100+). Locks when fewer than 3 slots are open.</li>
                <li><strong>Reroll.</strong> Swap one slot's 3 options for a fixed second three.</li>
                <li><strong>Streak.</strong> Counts the days you play, win or not. Wins in a row are tracked separately.</li>
                <li><strong>Share grid.</strong> One square per player, no names. Each square shows whether your pick was the best, middle or worst of the 3 you were offered.</li>
            </ul>
        </section>

        <section class="how-to-play-content__section">
            <h3 class="how-to-play-content__heading">Daily points (out of 1,000)</h3>
            <dl class="how-to-play-content__points">
                <div v-for="row in points" :key="row.label" class="how-to-play-content__point">
                    <dt>{{ row.label }}</dt>
                    <dd>{{ row.value }}</dd>
                </div>
            </dl>
            <p class="how-to-play-content__note">Any win beats any miss, and any finished XI beats a bust.</p>
        </section>

        <section class="how-to-play-content__section">
            <h3 class="how-to-play-content__heading">The Daily week</h3>
            <ol class="how-to-play-content__ladder">
                <li v-for="row in schedule" :key="row.weekday" class="how-to-play-content__rung how-to-play-content__rung--day">
                    <span class="how-to-play-content__day">{{ row.day }}</span>
                    <span>{{ row.label }}</span>
                </li>
            </ol>
            <p class="how-to-play-content__note">Formations rotate too, so no two weeks are the same. Over and under days end early or bust on the spot; read the top of the board first.</p>
        </section>

        <section class="how-to-play-content__section how-to-play-content__section--callout">
            <h3 class="how-to-play-content__heading">Challenge boards</h3>
            <p>
                A mate's board can swap the exact target for a different objective: <strong>score over</strong>
                it, <strong>stay under</strong> it, or <strong>keep every player under</strong> it.
            </p>
        </section>
    </div>
</template>

<style lang="scss" scoped>
// Bib & Board: small uppercase section labels, flat surface-2 panels, the
// target in a pitch-green "board" tile. The exact win is the red moment;
// a bust is slate (see the rules in app.vue).
.how-to-play-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    line-height: 1.5;

    p {
        margin: 0;
    }
}

.how-to-play-content__section {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
}

.how-to-play-content__heading {
    color: var(--color-muted);
    font-family: var(--font-body);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    line-height: 1.3;
    margin: 0;
    text-transform: uppercase;
}

.how-to-play-content__aim {
    align-items: center;
    display: flex;
    gap: 1rem;
}

.how-to-play-content__equation {
    align-items: center;
    background-color: var(--color-pitch);
    border-radius: var(--radius-md);
    color: var(--color-pitch-ink);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    padding: 0.5rem 0.85rem;
    text-align: center;
}

.how-to-play-content__formation {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 600;
    opacity: 0.85;
}

.how-to-play-content__arrow {
    font-size: 0.7rem;
    line-height: 1;
    opacity: 0.7;
    transform: rotate(90deg);
}

.how-to-play-content__target {
    font-family: var(--font-display);
    font-size: 2rem;
    font-variant-numeric: tabular-nums;
    font-weight: 900;
    line-height: 1;
}

.how-to-play-content__steps {
    counter-reset: step;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    list-style: none;
    margin: 0;
    padding: 0;

    li {
        align-items: baseline;
        counter-increment: step;
        display: flex;
        gap: 0.65rem;
    }

    li::before {
        align-items: center;
        background-color: var(--color-surface-2);
        border-radius: var(--radius-pill);
        color: var(--color-primary);
        content: counter(step);
        display: inline-flex;
        flex-shrink: 0;
        font-family: var(--font-display);
        font-size: 0.95rem;
        font-weight: 900;
        height: 1.6rem;
        justify-content: center;
        width: 1.6rem;
    }
}

.how-to-play-content__note {
    color: var(--color-muted);
    font-size: 0.85rem;
}

.how-to-play-content__outcomes {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    list-style: none;
    margin: 0;
    padding: 0;
}

.how-to-play-content__outcome {
    align-items: baseline;
    border-left: 4px solid;
    border-radius: var(--radius-sm);
    display: flex;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
}

.how-to-play-content__outcome--win {
    background-color: color-mix(in srgb, var(--color-bib) 9%, transparent);
    border-color: var(--color-bib);
}

.how-to-play-content__outcome--bust {
    background-color: color-mix(in srgb, var(--color-bust) 10%, transparent);
    border-color: var(--color-bust);
}

.how-to-play-content__outcome-name {
    flex: 0 0 5rem;
    font-size: 0.8rem;
    font-weight: 700;
}

.how-to-play-content__ladder {
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    list-style: none;
    margin: 0;
    overflow: hidden;
    padding: 0;
}

.how-to-play-content__rung {
    align-items: center;
    display: flex;
    font-size: 0.88rem;
    font-weight: 600;
    gap: 0.6rem;
    padding: 0.5rem 0.75rem;
}

// A tier-coloured dot rather than a full fill, so the ladder stays calm
// and readable in both schemes.
.how-to-play-content__rung::before {
    background-color: var(--rung-color);
    border-radius: var(--radius-pill);
    content: '';
    flex-shrink: 0;
    height: 0.6rem;
    width: 0.6rem;
}

.how-to-play-content__rung + .how-to-play-content__rung {
    border-top: 1px solid var(--color-line);
}

.how-to-play-content__rung-range {
    color: var(--color-muted);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    font-weight: 500;
    margin-left: auto;
}

// The shared --tier-* ladder from app.vue, so this matches StatsDialog and
// ResultPanel.
.how-to-play-content__rung--titleWinners {
    --rung-color: var(--tier-title);
}

// The week table reuses the ladder rows, without the tier dot.
.how-to-play-content__rung--day::before {
    display: none;
}

.how-to-play-content__day {
    color: var(--color-primary);
    flex: 0 0 2.5rem;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    font-weight: 700;
}

.how-to-play-content__daily-rules {
    display: flex;
    flex-direction: column;
    font-size: 0.88rem;
    gap: 0.45rem;
    margin: 0;
    padding-left: 1.1rem;
}

.how-to-play-content__points {
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    margin: 0;
    overflow: hidden;
}

.how-to-play-content__point {
    display: flex;
    font-size: 0.85rem;
    gap: 0.75rem;
    justify-content: space-between;
    padding: 0.45rem 0.75rem;

    dt {
        font-weight: 700;
    }

    dd {
        color: var(--color-muted);
        margin: 0;
        text-align: right;
    }
}

.how-to-play-content__point + .how-to-play-content__point {
    border-top: 1px solid var(--color-line);
}

.how-to-play-content__rung--championsLeague {
    --rung-color: var(--tier-cl);
}

.how-to-play-content__rung--europaLeague {
    --rung-color: var(--tier-el);
}

.how-to-play-content__rung--midTable {
    --rung-color: var(--tier-mid);
}

.how-to-play-content__rung--avoidedRelegation {
    --rung-color: var(--tier-avoided);
}

.how-to-play-content__rung--relegated {
    --rung-color: var(--tier-relegated);
}

.how-to-play-content__helpers {
    display: grid;
    gap: 0.5rem;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
}

.how-to-play-content__helper {
    background-color: var(--color-surface-2);
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    font-size: 0.85rem;
    gap: 0.25rem;
    padding: 0.75rem 0.85rem;

    strong {
        color: var(--color-primary);
        font-family: var(--font-display);
        font-size: 1.05rem;
        font-weight: 800;
        letter-spacing: 0.02em;
        text-transform: var(--display-text-transform);
    }
}

.how-to-play-content__section--callout {
    background-color: var(--color-surface-2);
    border-radius: var(--radius-md);
    font-size: 0.88rem;
    padding: 0.85rem 1rem;
}
</style>
