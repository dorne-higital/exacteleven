import type {
    ClueBand,
    DailyArchiveItem,
    DailyFullTime,
    DailyObjective,
    DailyPercentile,
    DailyScore,
    DailySnapshot,
    DailyStat,
    DailyWeekday,
    ShareCell,
    ShareLevel,
    WeeklyRecap,
} from '../../shared/daily2-types';
import type { ObjectiveKind, PositionGroup } from '../../shared/types';
import { formationLabel, shortDateLabel } from './share-daily';

// The Daily 2.0 screens' copy and small derivations (DAILY2_SPEC §6), kept
// out of the .vue files so they can be unit-tested and can't drift between
// the Daily page, the full-time card, the home card and the archive.

/** en-GB grouping: 1203 → "1,203". */
export function formatPoints(value: number): string {
    return Math.round(value).toLocaleString('en-GB');
}

/** "goals + assists" / "goals" / "assists" — what the day's number counts. */
export function statNoun(stat: DailyStat): string {
    if (stat === 'goals') {
        return 'goals';
    }

    return stat === 'assists' ? 'assists' : 'goals + assists';
}

/** Short tile label for the stat a pitch chip shows ("G+A", "G", "A"). */
export function statShort(stat: DailyStat): string {
    if (stat === 'goals') {
        return 'G';
    }

    return stat === 'assists' ? 'A' : 'G+A';
}

/** "Daily · Wed 14 Oct · 4-3-3" */
export function dailyHeading(date: string, formationCode: string): string {
    return `Daily · ${shortDateLabel(date)} · ${formationLabel(formationCode)}`;
}

/** The one-line rule under the objective chip, per objective kind. */
export function objectiveRuleLine(objective: Pick<DailyObjective, 'kind' | 'stat' | 'value'>): string {
    const noun = statNoun(objective.stat);

    switch (objective.kind) {
        case 'exact':
            return `Make your XI's ${noun} land on exactly ${objective.value}. Going over is a bust.`;
        case 'over':
            return `Get your XI's ${noun} past ${objective.value}. It ends the moment you do.`;
        case 'under':
            return `Fill the XI with ${noun} under ${objective.value}. Reaching ${objective.value} is a bust.`;
        case 'allUnder':
            return `Every player's ${noun} under ${objective.value}, captain doubled. One at ${objective.value}+ is a bust.`;
    }
}

export type RankPillTone = 'ranked' | 'practice' | 'archive' | 'pending';

/** The status pill under the Daily header (DAILY2_SPEC §6.1). */
export function rankPill(ranked: boolean | null, reason: string | null, archive: boolean): { label: string; tone: RankPillTone } {
    if (archive || reason === 'archive') {
        return { label: 'Archive · doesn\'t count', tone: 'archive' };
    }

    if (ranked === false) {
        if (reason === 'late' || reason === 'not_today') {
            return { label: 'Practice: this Daily has closed', tone: 'practice' };
        }

        return { label: 'Practice: your first go today already counted', tone: 'practice' };
    }

    return { label: 'Counts for today\'s table', tone: ranked === null ? 'pending' : 'ranked' };
}

/** "Scouting report: 31–60 goals + assists" */
export function clueChipText(band: Pick<ClueBand, 'label'>, stat: DailyStat): string {
    return `Scouting report: ${band.label} ${statNoun(stat)}`;
}

/** The big status line on the full-time card. */
export function fullTimeStatusLine(score: Pick<DailyScore, 'status' | 'total' | 'value' | 'filledBeforeBust'>, kind: ObjectiveKind): string {
    if (score.status === 'won') {
        switch (kind) {
            case 'exact':
                return 'Perfect XI!';
            case 'over':
                return `Cleared ${score.value}!`;
            case 'under':
                return `Stayed under ${score.value}!`;
            case 'allUnder':
                return `Every player under ${score.value}!`;
        }
    }

    if (score.status === 'bust') {
        const slots = score.filledBeforeBust ?? 0;

        return `Bust after ${slots} ${slots === 1 ? 'slot' : 'slots'}`;
    }

    // A completed miss: only exact and over have one.
    const short = Math.max(1, kind === 'over' ? score.value - score.total + 1 : score.value - score.total);

    return kind === 'over' ? `${short} short of clearing ${score.value}` : `${short} short of ${score.value}`;
}

/** "Base 862 · Clue −50 · Bench −100" (just "Base 1,000" with no helps). */
export function scoreBreakdown(score: Pick<DailyScore, 'base'>, helps: DailySnapshot['helps']): string {
    const parts = [`Base ${formatPoints(score.base)}`];

    if (helps.reroll) {
        parts.push('Reroll −50');
    }

    if (helps.clue) {
        parts.push('Clue −50');
    }

    if (helps.bench) {
        parts.push('Bench −100');
    }

    return parts.join(' · ');
}

/**
 * The percentile line. Ranked: "You beat 74% of players · 1,203 played
 * today", or the "first in" line when nobody else has played yet. Unranked:
 * "On the day you'd have beaten 61%". null when there's nothing to say yet.
 */
export function percentileLine(percentile: DailyPercentile | null, ranked: boolean, isToday: boolean): string | null {
    if (!percentile) {
        return ranked ? 'You\'re first in today. Check back later.' : null;
    }

    const played = `${formatPoints(percentile.players)} played ${isToday ? 'today' : 'that day'}`;

    if (percentile.beatPct === null) {
        return ranked ? 'You\'re first in today. Check back later.' : `${played}. Nobody else to compare with yet.`;
    }

    return ranked
        ? `You beat ${percentile.beatPct}% of players · ${played}`
        : `${isToday ? 'Practice run: you\'d have beaten' : 'On the day you\'d have beaten'} ${percentile.beatPct}% · ${played}`;
}

/** "There were 12 perfect XIs out of 19,683" / "40 of 729 XIs would have won". */
export function perfectXIsLine(fullTime: Pick<DailyFullTime, 'perfectXIs' | 'totalXIs'>, kind: ObjectiveKind): string {
    const perfect = formatPoints(fullTime.perfectXIs);
    const total = formatPoints(fullTime.totalXIs);

    if (kind === 'exact') {
        return fullTime.perfectXIs === 1
            ? `There was 1 perfect XI out of ${total}`
            : `There were ${perfect} perfect XIs out of ${total}`;
    }

    return `${perfect} of ${total} XIs would have won`;
}

/** "🔥 4-day streak · 2 wins in a row" */
export function streakLine(streak: number, winStreak: number): string {
    return `🔥 ${streak}-day streak · ${winStreak} ${winStreak === 1 ? 'win' : 'wins'} in a row`;
}

/** "Tue 13 Oct · 3-5-2 · Keep every player under 30 · 1,045 played" */
export function archiveRowText(item: Pick<DailyArchiveItem, 'date' | 'formationCode' | 'objective' | 'players'>): string {
    const parts = [shortDateLabel(item.date), formationLabel(item.formationCode), item.objective.label];

    if (item.players !== null) {
        parts.push(`${formatPoints(item.players)} played`);
    }

    return parts.join(' · ');
}

export interface ScheduleRow {
    weekday: DailyWeekday;
    day: string;
    label: string;
}

const WEEKDAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** The weekly rhythm, as the how-to-play table shows it. */
export function weekScheduleRows(schedule: Record<DailyWeekday, { kind: ObjectiveKind; stat: DailyStat }>): ScheduleRow[] {
    return ([0, 1, 2, 3, 4, 5, 6] as DailyWeekday[]).map((weekday) => {
        const { kind, stat } = schedule[weekday];
        const label = {
            over: 'Score over a target',
            under: 'Stay under a ceiling',
            allUnder: 'Keep every player under a limit',
            exact: stat === 'ga' ? 'Land exactly on the formation' : `Land exactly on ${stat === 'assists' ? 'an' : 'a'} ${stat} target`,
        }[kind];

        return { weekday, day: WEEKDAY_NAMES[weekday], label: weekday === 6 ? `${label} (hardest)` : label };
    });
}

export interface RecapBar {
    date: string;
    day: string;
    /** 0–100: the bar's height as a share of 1,000. null = not played. */
    youPct: number | null;
    youLabel: string;
    /** 0–100: the median dot's height. null = no median yet. */
    medianPct: number | null;
}

/** The Sunday recap's seven bars (missing days included, labelled "—"). */
export function recapBars(recap: Pick<WeeklyRecap, 'start' | 'days'>): RecapBar[] {
    const byDate = new Map(recap.days.map((day) => [day.date, day]));
    const [year, month, day] = recap.start.split('-').map(Number);
    const startMs = Date.UTC(year!, month! - 1, day!);

    return WEEKDAY_NAMES.map((name, index) => {
        const date = new Date(startMs + index * 86_400_000).toISOString().slice(0, 10);
        const entry = byDate.get(date);
        const you = entry?.you ?? null;

        return {
            date,
            day: name,
            youPct: you ? Math.max(0, Math.min(100, you.score / 10)) : null,
            youLabel: you ? String(you.score) : '—',
            medianPct: entry && entry.median !== null ? Math.max(0, Math.min(100, entry.median / 10)) : null,
        };
    });
}

/** "Week total 4,310 · beat 68% of players" (or the empty-week line). */
export function recapTotalLine(recap: Pick<WeeklyRecap, 'week'>): string {
    const you = recap.week.you;

    if (!you) {
        return 'No Dailies played this week yet.';
    }

    const beat = typeof you.beatPct === 'number' ? ` · beat ${you.beatPct}% of players` : '';

    return `Week total ${formatPoints(you.total)}${beat}`;
}

/** The share-card grid rows: FWD at the top, keeper at the bottom (matching the pitch). */
export function shareGridRows(grid: readonly ShareCell[]): ShareLevel[][] {
    const order: PositionGroup[] = ['FWD', 'MID', 'DEF', 'GK'];

    return order
        .map((group) => grid.filter((cell) => cell.group === group).map((cell) => cell.level))
        .filter((row) => row.length > 0);
}

/** Accessible name for one share-grid square. */
export const SHARE_LEVEL_LABEL: Record<ShareLevel, string> = {
    best: 'best pick',
    good: 'decent pick',
    poor: 'weakest pick',
    bust: 'bust',
    locked: 'locked',
    empty: 'not filled',
};
