// The hint only works while at least this many slots are still empty,
// counting the one being picked for. With fewer open, "which candidate
// leaves the most/fewest ways to win" stops being a nudge and becomes an
// exact oracle (on the final slot it's literally 1-or-0 per candidate), so
// saving the hint for the end turned it into a guaranteed win. Shared by
// /api/hint (which enforces it) and the client (which locks the button),
// so the two can't drift.
export const HINT_MIN_OPEN_SLOTS = 3;
