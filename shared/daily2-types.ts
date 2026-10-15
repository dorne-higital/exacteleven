// Daily 2.0 — the shared request/response and state shapes for the fixed-
// option Daily (GET /api/daily/v2 and friends) and the one-round-trip
// POST /api/pick. Imported by the server routes and the client composables
// alike, so the two can't drift. Additive only: shipped app builds read these
// fields, so never rename or repurpose one.
//
// "Fixed-option" means every player sees the same options per slot (seeded
// from the date, frozen in Netlify Blobs). The shapes deliberately don't say
// "daily" anywhere they don't have to, so the Weekly XI and Head-to-Head can
// reuse DailyPuzzle/DailyMove/DailySnapshot as-is later.
import type { DrawnPlayer, FormationCode, GameStatus, ObjectiveKind, Player, PositionGroup, RevealResult, WinOdds } from './types';

export type DailyStat = 'ga' | 'goals' | 'assists';
export type DailyWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // Mon=0
export interface DailyObjective { kind: ObjectiveKind; stat: DailyStat; value: number; label: string }
export type PuzzleOption = Omit<Player, 'goals' | 'assists' | 'position'>; // id,name,clubs,firstSeason,lastSeason,appearances
export type ClueBandId = 'b0' | 'b1' | 'b2' | 'b3' | 'b4';
export interface ClueBand { id: ClueBandId; label: string; min: number; max: number | null }

export interface DailyRules {
    rerolls: 1;
    clues: 1;
    benches: 1;
    clueMinOpenSlots: number; // HINT_MIN_OPEN_SLOTS
    captainRequired: true;
    points: { win: 1000; reroll: 50; clue: 50; bench: 100; missMax: 700; missFloor: 275; bustPerSlot: 25 };
    clueBands: ClueBand[];
}

export interface DailyPuzzle { // GET /api/daily/v2 (public, no stats except locked players)
    v: 2;
    date: string; // YYYY-MM-DD, Europe/London
    weekday: DailyWeekday;
    formationCode: FormationCode;
    objective: DailyObjective;
    locked: Array<{ slotId: string; player: Player }>;
    slots: Array<{ slotId: string; group: PositionGroup; options: PuzzleOption[] }>; // open slots, formation order, MAIN sets
    rules: DailyRules;
    isToday: boolean;
    nextDailyAt: string; // ISO, next UK midnight
}

export type DailyMove =
    | { t: 'pick'; slotId: string; playerId: string }
    | { t: 'reroll'; slotId: string }
    | { t: 'clue'; slotId: string; playerId: string }
    | { t: 'captain'; slotId: string }
    | { t: 'bench'; slotId: string }
    | { t: 'acceptBust' };

export type DailyMoveError =
    | 'bad_move' | 'game_over' | 'pending_bust' | 'slot_locked' | 'slot_filled' | 'slot_empty'
    | 'not_offered' | 'captain_required' | 'captain_set' | 'captain_would_bust'
    | 'reroll_used' | 'clue_used' | 'clue_locked' | 'bench_used' | 'no_pending_bust';

export interface DailySnapshot {
    status: GameStatus; // 'playing' | 'won' | 'lost' (completed miss) | 'bust'
    total: number; // counted (captain doubled)
    filled: number; // incl. locked
    openSlotIds: string[];
    captainSlotId: string | null;
    captainBlind: boolean;
    rerolledSlotId: string | null;
    clue: { slotId: string; playerId: string; band: ClueBandId } | null;
    bench: { slotId: string; outId: string; subId: string } | null;
    pendingBust: { slotId: string } | null;
    helps: { reroll: boolean; clue: boolean; bench: boolean };
    score: number | null; // final score once status !== 'playing'
}

export interface DailyScore {
    score: number;
    status: Exclude<GameStatus, 'playing' | 'finished'>;
    base: number;
    helpsCost: number;
    total: number;
    value: number;
    filledBeforeBust: number | null;
}

export type ShareLevel = 'best' | 'good' | 'poor' | 'bust' | 'locked' | 'empty';
export interface ShareCell { slotId: string; group: PositionGroup; level: ShareLevel; captain: boolean; benched: boolean }

export interface DailyFullTime {
    perfectXIs: number; // distinct main XIs with ≥1 winning captain
    totalXIs: number; // 3^open
    bestXI: { picks: Array<{ slotId: string; player: Player }>; captainSlotId: string; total: number };
    yourXI: Array<{ slotId: string; player: Player; locked: boolean; captain: boolean; benchedOut?: Player }>;
    passedOn: Array<{ slotId: string; set: 'main' | 'reroll'; player: Player }>; // options you SAW and didn't keep
    grid: ShareCell[]; // formation slot order
}

export interface DailyPercentile { beatPct: number | null; players: number }

// Routes
export interface DailyStartRequest { date: string; installId: string; runId: string; archive?: boolean }
export interface DailyStartResponse { ranked: boolean; reason?: 'archive' | 'not_first' | 'not_today'; firstRunId?: string }

export interface DailyPickRequest { mode: 'daily'; date: string; runId: string; moves: DailyMove[] } // last move = pick
export interface DailyPickResponse { status: 'ok'; reveal: RevealResult & { playerId: string }; snapshot: DailySnapshot; winOdds: WinOdds | null }

export interface DailyActionRequest { date: string; runId: string; moves: DailyMove[] } // last move = reroll|clue|captain|bench|acceptBust
export interface DailyActionResponse {
    snapshot: DailySnapshot;
    winOdds: WinOdds | null;
    reroll?: { slotId: string; options: PuzzleOption[] };
    clue?: { slotId: string; playerId: string; band: ClueBand };
    bench?: { slotId: string; outId: string; sub: Player };
}

export interface DailySubmitRequest { date: string; runId: string; installId: string; moves: DailyMove[]; archive?: boolean; platform: 'web' | 'ios' }
export interface DailySubmitResponse {
    ranked: boolean;
    reason?: 'archive' | 'not_first' | 'late';
    score: DailyScore;
    percentile: DailyPercentile | null; // ranked: live; unranked: read-only "on the day"; null if nobody played
    fullTime: DailyFullTime;
    alreadySubmitted?: boolean;
}

export interface DailyArchiveItem { date: string; weekday: DailyWeekday; formationCode: FormationCode; objective: DailyObjective; players: number | null }
export interface DailyArchiveResponse { items: DailyArchiveItem[]; nextBefore: string | null }

export interface WeeklyRecap {
    start: string;
    end: string; // Monday..Sunday
    days: Array<{
        date: string;
        weekday: DailyWeekday;
        formationCode: FormationCode;
        objective: DailyObjective;
        players: number;
        median: number | null;
        p90: number | null;
        you: { score: number; beatPct: number | null } | null;
    }>;
    week: { players: number; median: number | null; you: { total: number; played: number; beatPct: number | null } | null };
}

// Classic POST /api/pick
export interface ClassicPickRequest {
    mode: 'classic';
    gameId: string;
    token: string; // chosen candidate
    group: PositionGroup; // this slot's group (for an expiry redraw)
    total: number; // running total BEFORE this pick
    objectiveKind?: ObjectiveKind; // default 'exact'
    objectiveValue?: number; // default: target is required for classic → client always sends it
    exclude: string[]; // every id offered so far (≤60)
    openAfter: PositionGroup[]; // every still-empty slot AFTER this pick, incl. `next` (≤10)
    next?: { slotId: string; group: PositionGroup } | null;
    long?: boolean; // app: 30-min tokens
}
export interface ClassicPickResponse {
    status: 'ok' | 'expired';
    reveal?: RevealResult; // when ok
    next?: { slotId: string; candidates: DrawnPlayer[] } | null;
    winOdds?: WinOdds | null; // null below 6 filled
    redraw?: { candidates: DrawnPlayer[] }; // when expired: free fresh options for the SAME slot
}
