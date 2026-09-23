export type PositionGroup = 'GK' | 'DEF' | 'MID' | 'FWD';

export interface Player {
    id: string;
    name: string;
    position: PositionGroup;
    goals: number;
    assists: number;
    appearances: number;
    clubs: string[];
    firstSeason: number;
    lastSeason: number;
}

// The only seven three-digit formations that field 10 outfield players
// (1 GK + DEF + MID + FWD, digits summing to 10) — see the build brief §2.
export type FormationCode = '343' | '352' | '433' | '442' | '451' | '532' | '541';

export interface Slot {
    id: string;
    group: PositionGroup;
    /** Percentage position on the pitch, 0-100. */
    x: number;
    /** Percentage depth on the pitch, 0-100 — 0 is the attacking end, 100 is the goalkeeper's own goal. */
    y: number;
    /**
     * This slot's place within its DEF/MID/FWD row, by POSITION (first/last
     * vs. everything between), not a fixed pitch-percentage threshold — the
     * latter breaks for a row of 5, where two slots land on each side of any
     * fixed cutoff. GK is always 'Center'.
     */
    side: 'Left' | 'Center' | 'Right';
    /** How many slots share this row — needed to tell a back-four's fullback from a back-five's wing-back, and a front-two's striker from a front-three's winger. */
    rowSize: number;
}

export interface Formation {
    code: FormationCode;
    /** The formation code read as a number, e.g. 442 — also the score target. */
    target: number;
    /** Outfield player counts as [DEF, MID, FWD]. */
    rows: [number, number, number];
    slots: Slot[];
}

export type GameStatus = 'playing' | 'won' | 'bust' | 'finished';

// The league-table ladder a non-exact, non-bust finish lands on, worst to
// best read top-down in the UI (best first here): only set when
// `status === 'finished'`. Boundaries are tuned empirically in scoring.ts.
export type ResultTier = 'championsLeague' | 'europaLeague' | 'midTable' | 'avoidedRelegation' | 'relegated';

export interface GameSlot extends Slot {
    player: Player | null;
}

// The shape /api/draw returns for each of the 3 candidates offered for a slot:
// everything needed to render a choice, and nothing that would reveal the
// hidden score (goals/assists) per D2. `token` proves — via server-side
// signature verification, not client trust — that this exact player was
// genuinely offered in this game, so /api/reveal can check it later.
export type DrawnPlayer = Omit<Player, 'goals' | 'assists' | 'position'> & {
    token: string;
};

export interface RevealResult {
    goals: number;
    assists: number;
}

export interface GameState {
    /** Random per-playthrough id, minted client-side at startGame() and bound into every draw token's signature so a token can't be replayed outside the game it was issued for. */
    gameId: string;
    formationCode: FormationCode;
    target: number;
    slots: GameSlot[];
    /** Ids of every player shown in any slot's choice dialog so far, picked or not — excluded from later draws (D6). */
    offeredPlayerIds: string[];
    rerollsLeft: number;
    total: number;
    status: GameStatus;
    /** Set only when status === 'finished' — which league-table tier this non-exact, non-bust result landed on. */
    tier: ResultTier | null;
    /** The slot currently showing its choice dialog, or null when none is open. */
    activeSlotId: string | null;
    /** The 3 (or fewer) candidates currently offered for `activeSlotId`. */
    offeredPlayers: DrawnPlayer[];
    /** Guards against double-recording this game's outcome into localStorage stats if the component re-renders after the game ends. */
    statsRecorded: boolean;
}
