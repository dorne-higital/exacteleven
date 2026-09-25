// Shared between /api/draw (which draws this many) and /api/hint (which
// validates against it) — kept in one place so the two routes can't drift.
export const CANDIDATES_PER_DRAW = 3;
