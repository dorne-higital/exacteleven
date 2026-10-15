import type { DailyPuzzle, DailySubmitResponse, ShareCell, ShareLevel, WeeklyRecap } from '../../shared/daily2-types';
import type { PositionGroup } from '../../shared/types';

// The Daily 2.0 text share (DAILY2_SPEC §4.4): one square per player in the
// formation's shape, coloured by how much that pick helped, and no names —
// so it can be posted without spoiling the day's puzzle.
//
//   Exact XI Daily · Wed 14 Oct · 4-3-3
//   Land exactly on 433 · 812/1000 · beat 74%
//     🟥🟧🟥
//    🟥⬜🟧
//   🟧🟥🟥⬜
//      🟦
//   exacteleven.co.uk/daily

export const SHARE_EMOJI: Record<ShareLevel, string> = {
    best: '🟥',
    good: '🟧',
    poor: '⬜',
    bust: '⬛',
    locked: '🟦',
    empty: '▫️',
};

export const DAILY_SHARE_URL = 'exacteleven.co.uk/daily';

// Attack at the top, keeper at the bottom — how the pitch is drawn.
const ROW_ORDER: PositionGroup[] = ['FWD', 'MID', 'DEF', 'GK'];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "Wed 14 Oct" from YYYY-MM-DD — fixed English names, never the device
// locale, so everyone's share reads the same.
export function shortDateLabel(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    const at = new Date(Date.UTC(year!, month! - 1, day!));

    return `${WEEKDAYS[at.getUTCDay()]} ${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]}`;
}

// "4-3-3" from "433".
export function formationLabel(code: string): string {
    return code.split('').join('-');
}

// The grid's rows, FWD → MID → DEF → GK, each in slot order, centred with
// leading spaces. An emoji renders about two spaces wide, so a row one
// square shorter than the widest gets one space (half of two) per missing
// square.
export function shareGridLines(grid: readonly ShareCell[]): string[] {
    const rows = ROW_ORDER
        .map((group) => grid.filter((cell) => cell.group === group).map((cell) => SHARE_EMOJI[cell.level]))
        .filter((row) => row.length > 0);
    const widest = Math.max(0, ...rows.map((row) => row.length));

    return rows.map((row) => `${' '.repeat(widest - row.length)}${row.join('')}`);
}

export interface DailyShareOptions {
    /** The captain was named on an empty slot (bragging rights only). */
    captainBlind?: boolean;
}

export function buildDailyShareText(
    puzzle: Pick<DailyPuzzle, 'date' | 'formationCode' | 'objective'>,
    result: Pick<DailySubmitResponse, 'score' | 'percentile' | 'fullTime'>,
    options: DailyShareOptions = {},
): string {
    const scoreLine = [
        puzzle.objective.label,
        `${result.score.score}/1000${options.captainBlind ? ' (C) blind' : ''}`,
    ];
    const beatPct = result.percentile?.beatPct;

    if (typeof beatPct === 'number') {
        scoreLine.push(`beat ${beatPct}%`);
    }

    return [
        `Exact XI Daily · ${shortDateLabel(puzzle.date)} · ${formationLabel(puzzle.formationCode)}`,
        scoreLine.join(' · '),
        ...shareGridLines(result.fullTime.grid),
        DAILY_SHARE_URL,
    ].join('\n');
}

// The Sunday recap's "Share my week": one line per day played, then the
// week's total. Days not played show "—".
export function buildWeeklyRecapShareText(recap: WeeklyRecap): string {
    const days = recap.days.map((day) => `${shortDateLabel(day.date).slice(0, 3)} ${day.you ? day.you.score : '—'}`);
    const you = recap.week.you;
    const total = you ? `Week total ${you.total.toLocaleString('en-GB')}${typeof you.beatPct === 'number' ? ` · beat ${you.beatPct}%` : ''}` : 'Week total —';

    return [
        `Exact XI Daily · week of ${shortDateLabel(recap.start)}`,
        days.join(' · '),
        total,
        DAILY_SHARE_URL,
    ].join('\n');
}
