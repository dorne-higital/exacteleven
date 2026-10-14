<script setup lang="ts">
import type { FormationCode } from '../../shared/types';
import type { AchievementCategory, AchievementProgress } from '../utils/achievements';
import type { Outcome } from '../utils/scoring';
import { getAchievementProgress, TIERS } from '../utils/achievements';
import { FORMATION_DIFFICULTY, formations } from '../utils/formations';
import { isAvailable as gameCenterAvailable, showLeaderboards } from '../utils/game-center';
import { isAppBuild } from '../utils/platform';

const open = defineModel<boolean>('open', { default: false });

const { stats, resetStats } = useStats();

// App only: the Pro badge, the unassisted-wins count (on the website every
// win is unassisted, so it would just repeat Wins) and the Game Center
// button. The best run of exact Classic wins shows on both.
const isApp = isAppBuild();
const { isPro } = usePurchases();
const canOpenLeaderboards = ref(false);

onMounted(() => {
    canOpenLeaderboards.value = gameCenterAvailable();
});

function openLeaderboards(): void {
    void showLeaderboards();
}

const activeTab = ref<'stats' | 'achievements'>('stats');

// Same league-table language and --tier-* colour ladder as ResultPanel.vue — this
// is meant to read as "your own results table," not a generic stats widget,
// so it rhymes with what a player already sees at the end of a game.
const BAR_ROWS: ReadonlyArray<{ outcome: Outcome; label: string; colorClass: string; countKey: keyof typeof stats.value }> = [
    { outcome: 'champion', label: 'Champion', colorClass: 'win', countKey: 'wins' },
    { outcome: 'championsLeague', label: 'Champions League', colorClass: 'champions-league', countKey: 'championsLeague' },
    { outcome: 'europaLeague', label: 'Europa League', colorClass: 'europa-league', countKey: 'europaLeague' },
    { outcome: 'midTable', label: 'Mid-table', colorClass: 'mid-table', countKey: 'midTable' },
    { outcome: 'avoidedRelegation', label: 'Avoided relegation', colorClass: 'avoided-relegation', countKey: 'avoidedRelegation' },
    { outcome: 'relegated', label: 'Relegated', colorClass: 'relegated', countKey: 'relegated' },
];

const winRate = computed(() => (
    stats.value.gamesPlayed > 0 ? Math.round((stats.value.wins / stats.value.gamesPlayed) * 100) : 0
));

function barPercent(count: number): number {
    return stats.value.gamesPlayed > 0 ? (count / stats.value.gamesPlayed) * 100 : 0;
}

const bestResultLabel = computed(() => {
    const best = stats.value.bestResult;

    if (!best) {
        return null;
    }

    const row = BAR_ROWS.find((candidate) => candidate.outcome === best.outcome);
    const label = row ? row.label : 'Bust';

    return `${label} — ${best.formationCode}`;
});

// Which formations get played, not just how a game ended — a different data
// dimension from the outcome bars above, so it's colored with the formation
// picker's own difficulty tags (select-formation.vue) rather than the tier-ladder
// colors, and sorted by play count so the most-picked formation reads first.
interface FormationRow { code: FormationCode; count: number; tier: 'easier' | 'balanced' | 'hardest' }

const formationRows = computed<FormationRow[]>(() => (
    formations
        .map((formation) => ({
            code: formation.code,
            count: stats.value.formationPlays[formation.code],
            tier: FORMATION_DIFFICULTY[formation.code].tier,
        }))
        .sort((a, b) => b.count - a.count)
));

const mostPlayed = computed(() => {
    const top = formationRows.value[0];

    return top && top.count > 0 ? top.code : null;
});

// Thresholds are ascending within each section and stats only ever grow, so
// the first still-locked entry is always the very next one in reach —
// that's the only one worth captioning with live progress; the rest would
// just be noise across 127 badges.
interface AchievementSection {
    key: string;
    title: string;
    achievements: AchievementProgress[];
    next: AchievementProgress | null;
}

function toSection(key: string, title: string, achievements: AchievementProgress[]): AchievementSection {
    return { key, title, achievements, next: achievements.find((progress) => !progress.unlocked) ?? null };
}

// Featured up front: the three categories every player accrues just by
// playing. Tier and formation breakdowns are real badges too, but at 5 tiers
// x9 thresholds + 7 formations x9 thresholds they're 108 of the 134 total —
// mostly locked, mostly noise for a new or casual player — so they sit
// behind a single disclosure instead of diluting the featured three.
const featuredSections = computed<AchievementSection[]>(() => {
    const progress = getAchievementProgress(stats.value);
    const byCategory = (category: AchievementCategory) => progress.filter((p) => p.def.category === category);

    return [
        toSection('games-played', 'Games Played', byCategory('gamesPlayed')),
        toSection('games-won', 'Exact Wins', byCategory('gamesWon')),
        toSection('daily-streak', 'Daily Streak', byCategory('dailyStreak')),
    ];
});

const breakdownSections = computed<AchievementSection[]>(() => {
    const progress = getAchievementProgress(stats.value);
    const byCategory = (category: AchievementCategory, subKind?: string) => progress.filter((p) => (
        p.def.category === category && (subKind === undefined || p.def.subKind === subKind)
    ));

    return [
        ...TIERS.map((tier) => toSection(`tier-${tier.key}`, tier.label, byCategory('tier', tier.key))),
        ...formations.map((formation) => toSection(`formation-${formation.code}`, `${formation.code} Wins`, byCategory('formationWin', formation.code))),
    ];
});

const achievementSummary = computed(() => {
    const all = [...featuredSections.value, ...breakdownSections.value].flatMap((section) => section.achievements);

    return { unlocked: all.filter((progress) => progress.unlocked).length, total: all.length };
});

const breakdownSummary = computed(() => {
    const all = breakdownSections.value.flatMap((section) => section.achievements);

    return { unlocked: all.filter((progress) => progress.unlocked).length, total: all.length };
});

function badgeLabel(progress: AchievementProgress): string {
    const status = progress.unlocked ? 'Unlocked' : `Locked — ${progress.current} of ${progress.def.threshold}`;

    return `${progress.def.label}. ${status}. ${progress.def.description}`;
}

function handleReset(): void {
    resetStats();
}
</script>

<template>
    <CenteredDialog v-model:open="open" title="Your stats">
        <div aria-label="Stats sections" class="stats-dialog__tabs" role="tablist">
            <button
                id="stats-dialog-tab-stats"
                aria-controls="stats-dialog-panel"
                :aria-selected="activeTab === 'stats'"
                class="stats-dialog__tab"
                :class="{ 'stats-dialog__tab--active': activeTab === 'stats' }"
                role="tab"
                type="button"
                @click="activeTab = 'stats'"
            >
                Stats
            </button>
            <button
                id="stats-dialog-tab-achievements"
                aria-controls="stats-dialog-panel"
                :aria-selected="activeTab === 'achievements'"
                class="stats-dialog__tab"
                :class="{ 'stats-dialog__tab--active': activeTab === 'achievements' }"
                role="tab"
                type="button"
                @click="activeTab = 'achievements'"
            >
                Achievements ({{ achievementSummary.unlocked }}/{{ achievementSummary.total }})
            </button>
        </div>

        <div
            v-if="activeTab === 'stats'"
            id="stats-dialog-panel"
            aria-labelledby="stats-dialog-tab-stats"
            class="stats-dialog__panel"
            role="tabpanel"
        >
            <p v-if="isApp && isPro" class="stats-dialog__pro">
                <span class="stats-dialog__pro-badge">Pro</span>
                Thanks for backing Exact XI
            </p>

            <div class="stats-dialog__hero">
                <div class="stats-dialog__hero-stat">
                    <span class="stats-dialog__hero-value">{{ stats.gamesPlayed }}</span>
                    <span class="stats-dialog__hero-label">Games played</span>
                </div>
                <div class="stats-dialog__hero-stat">
                    <span class="stats-dialog__hero-value">{{ winRate }}%</span>
                    <span class="stats-dialog__hero-label">Win rate</span>
                </div>
                <div class="stats-dialog__hero-stat">
                    <span class="stats-dialog__hero-value">{{ stats.dailyStreak }}</span>
                    <span class="stats-dialog__hero-label">Daily streak</span>
                </div>
            </div>

            <p v-if="bestResultLabel" class="stats-dialog__best">
                <span class="stats-dialog__best-label">Best</span>
                <span class="stats-dialog__best-value">{{ bestResultLabel }}</span>
            </p>

            <dl class="stats-dialog__runs">
                <div class="stats-dialog__run">
                    <dt>Exact-win run</dt>
                    <dd>{{ stats.currentExactRun }}</dd>
                </div>
                <div class="stats-dialog__run">
                    <dt>Best run</dt>
                    <dd>{{ stats.bestExactRun }}</dd>
                </div>
                <div v-if="isApp" class="stats-dialog__run">
                    <dt>Unassisted wins</dt>
                    <dd>{{ stats.unassistedWins }}</dd>
                </div>
            </dl>

            <div class="stats-dialog__bars">
                <div v-for="row in BAR_ROWS" :key="row.outcome" class="stats-dialog__bar-row">
                    <span class="stats-dialog__bar-label">{{ row.label }}</span>
                    <div class="stats-dialog__bar-track">
                        <div
                            class="stats-dialog__bar-fill"
                            :class="`stats-dialog__bar-fill--${row.colorClass}`"
                            :style="{ width: `${barPercent(stats[row.countKey] as number)}%` }"
                        />
                    </div>
                    <span class="stats-dialog__bar-count">{{ stats[row.countKey] }}</span>
                </div>
                <div class="stats-dialog__bar-row">
                    <span class="stats-dialog__bar-label">Bust</span>
                    <div class="stats-dialog__bar-track">
                        <div
                            class="stats-dialog__bar-fill stats-dialog__bar-fill--bust"
                            :style="{ width: `${barPercent(stats.busts)}%` }"
                        />
                    </div>
                    <span class="stats-dialog__bar-count">{{ stats.busts }}</span>
                </div>
            </div>

            <div v-if="mostPlayed" class="stats-dialog__formations">
                <p class="stats-dialog__formations-heading">
                    Most played <span class="stats-dialog__formations-top">{{ mostPlayed }}</span>
                </p>
                <div class="stats-dialog__bars">
                    <div v-for="row in formationRows" :key="row.code" class="stats-dialog__bar-row">
                        <span class="stats-dialog__bar-label">{{ row.code }}</span>
                        <div class="stats-dialog__bar-track">
                            <div
                                class="stats-dialog__bar-fill"
                                :class="`stats-dialog__formation-fill--${row.tier}`"
                                :style="{ width: `${barPercent(row.count)}%` }"
                            />
                        </div>
                        <span class="stats-dialog__bar-count">{{ row.count }}</span>
                    </div>
                </div>
            </div>

            <button v-if="isApp && canOpenLeaderboards" class="stats-dialog__leaderboards" type="button" @click="openLeaderboards">
                <AppIcon name="trophy" />
                Game Center leaderboards
            </button>

            <button class="stats-dialog__reset" type="button" @click="handleReset">Reset stats</button>
        </div>

        <div
            v-else
            id="stats-dialog-panel"
            aria-labelledby="stats-dialog-tab-achievements"
            class="achievements-tab"
            role="tabpanel"
        >
            <p class="achievements-tab__intro">
                {{ achievementSummary.unlocked }} of {{ achievementSummary.total }} unlocked — badges gray out until you
                reach them, so you can always see what's next.
            </p>

            <div v-for="section in featuredSections" :key="section.key" class="achievements-tab__section">
                <p class="achievements-tab__section-title">
                    {{ section.title }}
                    <span v-if="section.next" class="achievements-tab__section-next">
                        {{ section.next.current }}/{{ section.next.def.threshold }}
                    </span>
                </p>
                <div class="achievements-tab__grid">
                    <div
                        v-for="progress in section.achievements"
                        :key="progress.def.id"
                        class="achievements-tab__badge"
                        :title="badgeLabel(progress)"
                    >
                        <AchievementBadge
                            :category="progress.def.category"
                            :rank="progress.def.rank"
                            :threshold="progress.def.threshold"
                            :unlocked="progress.unlocked"
                        />
                        <span class="achievements-tab__badge-sr">{{ badgeLabel(progress) }}</span>
                    </div>
                </div>
            </div>

            <details class="achievements-tab__breakdown">
                <summary class="achievements-tab__breakdown-summary">
                    <span>By tier &amp; formation</span>
                    <span class="achievements-tab__breakdown-count">
                        {{ breakdownSummary.unlocked }}/{{ breakdownSummary.total }}
                    </span>
                    <AppIcon class="achievements-tab__breakdown-chevron" name="chevron" />
                </summary>
                <div v-for="section in breakdownSections" :key="section.key" class="achievements-tab__section">
                    <p class="achievements-tab__section-title">
                        {{ section.title }}
                        <span v-if="section.next" class="achievements-tab__section-next">
                            {{ section.next.current }}/{{ section.next.def.threshold }}
                        </span>
                    </p>
                    <div class="achievements-tab__grid">
                        <div
                            v-for="progress in section.achievements"
                            :key="progress.def.id"
                            class="achievements-tab__badge"
                            :title="badgeLabel(progress)"
                        >
                            <AchievementBadge
                                :category="progress.def.category"
                                :rank="progress.def.rank"
                                :threshold="progress.def.threshold"
                                :unlocked="progress.unlocked"
                            />
                            <span class="achievements-tab__badge-sr">{{ badgeLabel(progress) }}</span>
                        </div>
                    </div>
                </div>
            </details>
        </div>
    </CenteredDialog>
</template>

<style lang="scss" scoped>
// Bib & Board stats: a segmented tab control, a three-up scoreboard card
// (display-face numbers split by hairlines), then the results table as
// thin bars on the --tier-* ladder with mono counts.
.stats-dialog__tabs {
    background-color: var(--color-surface-2);
    border-radius: var(--radius-md);
    display: flex;
    gap: 0.25rem;
    margin-bottom: 1.1rem;
    padding: 0.25rem;
}

.stats-dialog__tab {
    background: none;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    color: var(--color-muted);
    cursor: pointer;
    flex: 1 1 0;
    font: inherit;
    font-size: 0.85rem;
    font-weight: 700;
    min-height: calc(var(--tap-min) - 0.5rem);
    padding: 0.35rem 0.6rem;
}

.stats-dialog__tab:hover {
    color: var(--color-foreground);
}

// Active state: the raised surface plus a red underline — the "active"
// use of the bib red.
.stats-dialog__tab--active {
    background-color: var(--color-surface);
    border-color: var(--color-line);

    // Not combined with var(--shadow-sm): that token is none in dark mode
    // and several kits, which would void the whole list and lose the red.
    box-shadow: inset 0 -2px 0 var(--color-bib);
    color: var(--color-foreground);
}

.stats-dialog__panel {
    display: flex;
    flex-direction: column;
}

.stats-dialog__hero {
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    margin-bottom: 0.75rem;
    overflow: hidden;
}

.stats-dialog__hero-stat {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    min-width: 0;
    padding: 0.75rem 0.8rem 0.7rem;
}

.stats-dialog__hero-stat + .stats-dialog__hero-stat {
    border-left: 1px solid var(--color-line);
}

.stats-dialog__hero-value {
    font-family: var(--font-display);
    font-size: 2.25rem;
    font-variant-numeric: tabular-nums;
    font-weight: 900;
    line-height: 0.95;
}

.stats-dialog__hero-label {
    color: var(--color-muted);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}

.stats-dialog__best {
    align-items: baseline;
    background-color: var(--color-surface-2);
    border-radius: var(--radius-md);
    display: flex;
    flex-wrap: wrap;
    font-size: 0.875rem;
    gap: 0.5rem;
    margin: 0 0 0.75rem;
    padding: 0.6rem 0.8rem;
}

.stats-dialog__best-label {
    color: var(--color-muted);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}

.stats-dialog__best-value {
    font-weight: 700;
}

// Pro: a small bib-red badge (the "captain-style highlight" use of red).
.stats-dialog__pro {
    align-items: center;
    color: var(--color-muted);
    display: flex;
    font-size: 0.8rem;
    font-weight: 600;
    gap: 0.5rem;
    margin: 0 0 0.75rem;
}

.stats-dialog__pro-badge {
    background-color: var(--color-bib);
    border-radius: var(--radius-pill);
    color: var(--color-on-bib);
    font-family: var(--font-display);
    font-size: 0.85rem;
    font-weight: 900;
    letter-spacing: 0.06em;
    padding: 0.1rem 0.6rem;
    text-transform: uppercase;
}

// Exact-win runs: a quiet row of mono counts under the Best line.
.stats-dialog__runs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0 0 1.25rem;
}

.stats-dialog__run {
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    display: flex;
    flex: 1 1 0;
    flex-direction: column;
    gap: 0.2rem;
    min-width: 6rem;
    padding: 0.5rem 0.7rem;
}

.stats-dialog__run dt {
    color: var(--color-muted);
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}

.stats-dialog__run dd {
    font-family: var(--font-mono);
    font-size: 1.1rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    margin: 0;
}

.stats-dialog__leaderboards {
    align-items: center;
    align-self: flex-start;
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    color: var(--color-foreground);
    cursor: pointer;
    display: inline-flex;
    font: inherit;
    font-size: 0.85rem;
    font-weight: 700;
    gap: 0.4rem;
    margin-top: 1.5rem;
    min-height: var(--tap-min);
    padding: 0 1rem;
}

.stats-dialog__leaderboards:hover,
.stats-dialog__leaderboards:focus-visible {
    border-color: var(--color-primary);
    color: var(--color-primary);
}

.stats-dialog__leaderboards + .stats-dialog__reset {
    margin-top: 0.75rem;
}

.stats-dialog__bars {
    display: flex;
    flex-direction: column;
    gap: 0.65rem;
}

.stats-dialog__bar-row {
    align-items: center;
    display: grid;
    gap: 0.6rem;
    grid-template-columns: 7.5rem 1fr 2.25rem;
}

.stats-dialog__bar-label {
    font-size: 0.8rem;
    font-weight: 600;
}

.stats-dialog__bar-track {
    background-color: var(--color-surface-2);
    border-radius: var(--radius-pill);
    height: 0.5rem;
    overflow: hidden;
}

.stats-dialog__bar-fill {
    border-radius: inherit;
    height: 100%;
}

// The shared result ladder from app.vue. Champion (an exact hit) is the
// one red bar — the "exact" win moment.
.stats-dialog__bar-fill--win {
    background-color: var(--color-bib);
}

.stats-dialog__bar-fill--champions-league {
    background-color: var(--tier-cl);
}

.stats-dialog__bar-fill--europa-league {
    background-color: var(--tier-el);
}

.stats-dialog__bar-fill--mid-table {
    background-color: var(--tier-mid);
}

.stats-dialog__bar-fill--avoided-relegation {
    background-color: var(--tier-avoided);
}

.stats-dialog__bar-fill--relegated {
    background-color: var(--tier-relegated);
}

// Busts are slate, never red. Hatched so they don't read as the
// (also slate) mid-table bar.
.stats-dialog__bar-fill--bust {
    background: repeating-linear-gradient(
        -45deg,
        var(--color-bust) 0 3px,
        color-mix(in srgb, var(--color-bust) 45%, transparent) 3px 6px
    );
}

.stats-dialog__formations {
    border-top: 1px solid var(--color-line);
    margin-top: 1.1rem;
    padding-top: 1rem;
}

.stats-dialog__formations-heading {
    align-items: baseline;
    color: var(--color-muted);
    display: flex;
    font-size: 0.7rem;
    font-weight: 700;
    gap: 0.4rem;
    letter-spacing: 0.1em;
    margin: 0 0 0.65rem;
    text-transform: uppercase;
}

.stats-dialog__formations-top {
    color: var(--color-foreground);
    font-family: var(--font-mono);
    font-size: 0.8rem;
    letter-spacing: 0;
}

// The formation picker's own difficulty tags (select-formation.vue): green,
// slate, amber — a different data dimension from the outcome ladder above.
.stats-dialog__formation-fill--easier {
    background-color: var(--color-primary);
}

.stats-dialog__formation-fill--balanced {
    background-color: var(--color-slate);
}

.stats-dialog__formation-fill--hardest {
    background-color: var(--color-amber);
}

.stats-dialog__bar-count {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    text-align: right;
}

.stats-dialog__formations .stats-dialog__bar-label {
    font-family: var(--font-mono);
}

// Destructive but not celebratory, so amber on hover rather than red.
.stats-dialog__reset {
    align-self: flex-start;
    background: none;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    color: var(--color-muted);
    cursor: pointer;
    font: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    margin-top: 1.5rem;
    min-height: var(--tap-min);
    padding: 0 1rem;
}

.stats-dialog__reset:hover,
.stats-dialog__reset:focus-visible {
    border-color: var(--color-amber);
    color: var(--color-foreground);
}

.achievements-tab {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
}

.achievements-tab__intro {
    color: var(--color-muted);
    font-size: 0.82rem;
    line-height: 1.45;
    margin: 0;
}

.achievements-tab__section-title {
    align-items: baseline;
    color: var(--color-foreground);
    display: flex;
    font-family: var(--font-display);
    font-size: 1rem;
    font-weight: 800;
    gap: 0.5rem;
    justify-content: space-between;
    letter-spacing: 0.04em;
    margin: 0 0 0.55rem;
    text-transform: uppercase;
}

.achievements-tab__section-next {
    background-color: var(--color-surface-2);
    border-radius: var(--radius-pill);
    color: var(--color-primary);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    letter-spacing: 0;
    padding: 0.15rem 0.5rem;
}

.achievements-tab__grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.achievements-tab__breakdown {
    border-top: 1px solid var(--color-line);
    padding-top: 0.75rem;
}

.achievements-tab__breakdown[open] .achievements-tab__breakdown-summary {
    margin-bottom: 1rem;
}

.achievements-tab__breakdown-summary {
    align-items: center;
    border: 1px solid var(--color-line);
    border-radius: var(--radius-md);
    color: var(--color-foreground);
    cursor: pointer;
    display: flex;
    font-size: 0.85rem;
    font-weight: 700;
    gap: 0.5rem;
    list-style: none;
    min-height: var(--tap-min);
    padding: 0 0.85rem;
}

// Hide the native disclosure triangle — the chevron replaces it.
.achievements-tab__breakdown-summary::-webkit-details-marker {
    display: none;
}

.achievements-tab__breakdown-summary:hover {
    border-color: var(--color-primary);
}

.achievements-tab__breakdown-count {
    color: var(--color-muted);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    margin-left: auto;
}

.achievements-tab__breakdown-chevron {
    color: var(--color-muted);
    flex-shrink: 0;
    transform: rotate(90deg);
    transition: transform 0.15s ease;
}

.achievements-tab__breakdown[open] .achievements-tab__breakdown-chevron {
    transform: rotate(-90deg);
}

@media (prefers-reduced-motion: reduce) {
    .achievements-tab__breakdown-chevron {
        transition: none;
    }
}

.achievements-tab__breakdown-summary:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
}

.achievements-tab__breakdown .achievements-tab__section + .achievements-tab__section {
    margin-top: 1.25rem;
}

.achievements-tab__badge {
    flex-shrink: 0;
}

// The accessible label lives here so screen readers reach it as ordinary
// text, since the SVG badge itself is aria-hidden (decorative — its shapes
// don't spell out the rank/threshold on their own).
.achievements-tab__badge-sr {
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
</style>
