<script setup lang="ts">
import type { FormationCode } from '../../shared/types';
import type { AchievementCategory, AchievementProgress } from '../utils/achievements';
import type { Outcome } from '../utils/scoring';
import { getAchievementProgress, TIERS } from '../utils/achievements';
import { FORMATION_DIFFICULTY, formations } from '../utils/formations';

const open = defineModel<boolean>('open', { default: false });

const { stats, resetStats } = useStats();

const activeTab = ref<'stats' | 'achievements'>('stats');

// Same league-table language and color progression as ResultPanel.vue — this
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
// picker's own difficulty tiers (index.vue) rather than the tier-ladder
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

const achievementSections = computed<AchievementSection[]>(() => {
    const progress = getAchievementProgress(stats.value);
    const byCategory = (category: AchievementCategory, subKind?: string) => progress.filter((p) => (
        p.def.category === category && (subKind === undefined || p.def.subKind === subKind)
    ));

    return [
        toSection('games-played', 'Games Played', byCategory('gamesPlayed')),
        toSection('games-won', 'Exact Wins', byCategory('gamesWon')),
        ...TIERS.map((tier) => toSection(`tier-${tier.key}`, tier.label, byCategory('tier', tier.key))),
        ...formations.map((formation) => toSection(`formation-${formation.code}`, `${formation.code} Wins`, byCategory('formationWin', formation.code))),
        toSection('daily-streak', 'Daily Streak', byCategory('dailyStreak')),
    ];
});

const achievementSummary = computed(() => {
    const all = achievementSections.value.flatMap((section) => section.achievements);

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
        <div class="stats-dialog__tabs" role="tablist">
            <button
                aria-selected="true"
                class="stats-dialog__tab"
                :class="{ 'stats-dialog__tab--active': activeTab === 'stats' }"
                role="tab"
                type="button"
                @click="activeTab = 'stats'"
            >
                Stats
            </button>
            <button
                aria-selected="false"
                class="stats-dialog__tab"
                :class="{ 'stats-dialog__tab--active': activeTab === 'achievements' }"
                role="tab"
                type="button"
                @click="activeTab = 'achievements'"
            >
                Achievements ({{ achievementSummary.unlocked }}/{{ achievementSummary.total }})
            </button>
        </div>

        <template v-if="activeTab === 'stats'">
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
                <strong>Best:</strong> {{ bestResultLabel }}
            </p>

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
                <p class="stats-dialog__formations-heading">Most played: {{ mostPlayed }}</p>
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

            <button class="stats-dialog__reset" type="button" @click="handleReset">Reset stats</button>
        </template>

        <div v-else class="achievements-tab">
            <p class="achievements-tab__intro">
                {{ achievementSummary.unlocked }} of {{ achievementSummary.total }} unlocked — badges gray out until you
                reach them, so you can always see what's next.
            </p>

            <div v-for="section in achievementSections" :key="section.key" class="achievements-tab__section">
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
        </div>
    </CenteredDialog>
</template>

<style lang="scss" scoped>
.stats-dialog__tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.stats-dialog__tab {
    background: none;
    border: 1px solid color-mix(in srgb, var(--color-foreground) 20%, transparent);
    border-radius: 999px;
    color: color-mix(in srgb, var(--color-foreground) 70%, transparent);
    cursor: pointer;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    padding: 0.4rem 0.85rem;
}

.stats-dialog__tab--active {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-background);
}

.stats-dialog__hero {
    display: flex;
    gap: 1.5rem;
    margin-bottom: 0.75rem;
}

.stats-dialog__hero-stat {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
}

.stats-dialog__hero-value {
    font-family: var(--font-display);
    font-size: 2rem;
    font-variant-numeric: tabular-nums;
    line-height: 1;
}

.stats-dialog__hero-label {
    color: color-mix(in srgb, var(--color-foreground) 70%, transparent);
    font-size: 0.7rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
}

.stats-dialog__best {
    background-color: color-mix(in srgb, var(--color-foreground) 6%, transparent);
    border-radius: 0.5rem;
    font-size: 0.85rem;
    margin: 0 0 1rem;
    padding: 0.5rem 0.75rem;
}

.stats-dialog__bars {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
}

.stats-dialog__bar-row {
    align-items: center;
    display: grid;
    gap: 0.6rem;
    grid-template-columns: 7.5rem 1fr 1.75rem;
}

.stats-dialog__bar-label {
    font-size: 0.75rem;
}

.stats-dialog__bar-track {
    background-color: color-mix(in srgb, var(--color-foreground) 10%, transparent);
    border-radius: 999px;
    height: 0.5rem;
    overflow: hidden;
}

.stats-dialog__bar-fill {
    border-radius: inherit;
    height: 100%;
}

// Same progression as ResultPanel.vue's tone colors — built from the same 3
// tokens (primary/foreground/danger), not arbitrary per-tier hexes.
.stats-dialog__bar-fill--win {
    background-color: var(--color-primary);
}

.stats-dialog__bar-fill--champions-league {
    background-color: color-mix(in srgb, var(--color-primary) 85%, var(--color-foreground) 15%);
}

.stats-dialog__bar-fill--europa-league {
    background-color: color-mix(in srgb, var(--color-primary) 55%, var(--color-foreground) 45%);
}

.stats-dialog__bar-fill--mid-table {
    background-color: color-mix(in srgb, var(--color-foreground) 35%, transparent);
}

.stats-dialog__bar-fill--avoided-relegation {
    background-color: color-mix(in srgb, var(--color-danger) 55%, var(--color-foreground) 45%);
}

.stats-dialog__bar-fill--relegated {
    background-color: color-mix(in srgb, var(--color-danger) 80%, var(--color-foreground) 20%);
}

.stats-dialog__bar-fill--bust {
    background-color: var(--color-danger);
}

.stats-dialog__formations {
    border-top: 1px solid color-mix(in srgb, var(--color-foreground) 12%, transparent);
    margin-top: 0.25rem;
    padding-top: 1rem;
}

.stats-dialog__formations-heading {
    color: color-mix(in srgb, var(--color-foreground) 70%, transparent);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    margin: 0 0 0.6rem;
    text-transform: uppercase;
}

// The formation picker's own difficulty colors (index.vue), not the outcome
// tier progression above — a different data dimension, deliberately
// visually distinct rather than blending into the outcome bars.
.stats-dialog__formation-fill--easier {
    background-color: var(--color-primary);
}

.stats-dialog__formation-fill--balanced {
    background-color: color-mix(in srgb, var(--color-foreground) 65%, transparent);
}

.stats-dialog__formation-fill--hardest {
    background-color: var(--color-danger);
}

.stats-dialog__bar-count {
    font-family: var(--font-display);
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
    text-align: right;
}

.stats-dialog__reset {
    background: none;
    border: 1px solid color-mix(in srgb, var(--color-foreground) 20%, transparent);
    border-radius: 0.4rem;
    color: color-mix(in srgb, var(--color-foreground) 70%, transparent);
    cursor: pointer;
    font: inherit;
    font-size: 0.75rem;
    margin-top: 1.25rem;
    padding: 0.4rem 0.8rem;
}

.stats-dialog__reset:hover,
.stats-dialog__reset:focus-visible {
    border-color: var(--color-danger);
    color: var(--color-danger);
}

.achievements-tab {
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
}

.achievements-tab__intro {
    color: color-mix(in srgb, var(--color-foreground) 70%, transparent);
    font-size: 0.78rem;
    line-height: 1.4;
    margin: 0;
}

.achievements-tab__section-title {
    align-items: baseline;
    color: color-mix(in srgb, var(--color-foreground) 70%, transparent);
    display: flex;
    font-size: 0.7rem;
    font-weight: 700;
    gap: 0.5rem;
    justify-content: space-between;
    letter-spacing: 0.06em;
    margin: 0 0 0.5rem;
    text-transform: uppercase;
}

.achievements-tab__section-next {
    color: var(--color-primary);
    font-variant-numeric: tabular-nums;
}

.achievements-tab__grid {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
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
