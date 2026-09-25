# Todos

## Medium

- Daily & challenge make it seem like the main game is not part of it. Can we put the main game behind a full width block like them, with the same design (diff icon behind), which then loads a new play screen with the formation picker, so home will have full width [Play game], then below 2 x 50% [Daily challenge][Challeneg friend]

    **Feasibility: Straightforward. Timescale: half a day to a day.**
    Right now `app/pages/index.vue` has the 50/50 Daily/Challenge card row, then the formation list directly below it on the same page. The work is mostly moving existing pieces, not building new ones:
    - New page (e.g. `app/pages/select-formation.vue`) that hosts the current `<ul class="formations">` block and its steps/lede copy, basically lifted as-is out of `index.vue`.
    - New full-width "Play game" card added above the existing entry-cards row on the home page, styled off the same `.daily-card` shell already used for Daily/Challenge (just full-width instead of 50%, with its own bleed icon), linking to the new page.
    - The existing entry-cards row becomes a plain 2-up row on its own below it.
    No changes needed to the actual formation-picking logic, `/play` route, or game state — this is purely a navigation/layout restructure using patterns already in the codebase.

## Large

- Not if doable, but would like to make something for when you're filling your team in, it has like XXXX ways to get 100% or something. So its calculating based on the options how many times you "could" win. Would be good to always show at least 1 player each time which could help you win too

    **Feasibility: Doable, but the two halves of this split very differently in effort.**
    Hidden stats (goals/assists) are deliberately never sent to the client until reveal (`/api/draw` explicitly excludes them) — everything has to be computed server-side.

    **"Highlight at least 1 helpful player among the 3 offered" — Easy, timescale: a day.**
    At the moment a slot is drawn, the server already knows the hidden goals/assists for all 3 offered candidates, the running total so far, and the target. It's a small amount of arithmetic to flag which of the 3 candidates keep the objective mathematically reachable (e.g. don't guarantee an instant bust) and return that as an extra hint flag alongside each candidate. Self-contained in `server/api/draw.get.ts`, no new data or architecture needed.

    **"XXXX ways to win" as a live combinatorial count — Hard, timescale: several days, and likely needs scoping down.**
    The catch: only the *current* slot has been drawn (3 known candidates). Every slot after that hasn't been drawn yet, so its eventual 3 candidates could be any of the hundreds of remaining players at that position — there's no fixed, countable set of "remaining combinations" to enumerate honestly until each slot is actually reached. A literal, accurate "X ways left to win" would mean simulating over the full remaining player pool per undrawn position, which is closer to a probability estimate (Monte Carlo sampling, or precomputed min/max stat ranges per position) than a simple count, and the number shown would need careful framing so it doesn't imply more precision than it has.
    Suggest starting with the "helpful pick" hint above (which delivers most of the practical benefit) and treating the live odds/counter as a separate follow-up if it's still wanted once that's in.