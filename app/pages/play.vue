<script setup lang="ts">
import { gameMode } from '../composables/useGame';
import { trackEvent } from '../utils/analytics';
import { getFormation } from '../utils/formations';

const route = useRoute();
const formationCode = computed(() => String(route.query.f ?? ''));
const formation = computed(() => getFormation(formationCode.value));

const { state, isDrawing, pendingSlotId, drawError, drawErrorMessage, startGame, resumeGame, openSlot, closeDialog, refreshWinOdds } = useGame();
const { isWide } = useViewport();
const pickerBusy = useState<boolean>('exact-xi-picker-busy', () => false);

// Whether the setup block below already resolved this page's game on the
// client (resumed or started) — onMounted then has nothing left to do.
let resolvedOnClient = false;

// Only (re)start when there's no game yet, or it's for a different formation
// than this route asks for — revisiting the same formation keeps whatever
// progress is already in state rather than wiping it out. Server-side
// (storage isn't available there) this always produces a fresh game for the
// first render, and resumeGame() in onMounted corrects that after
// hydration. Client-side — a client-side navigation here, or every load of
// the ssr:false iOS app — it must try resuming FIRST: startGame() persists
// the fresh game, which used to overwrite the saved one before onMounted
// could read it back (losing the game and firing a spurious game_start).
// "Different game" also covers a Daily or challenge on the same formation:
// game state is shared between modes, so a Daily 4-3-3 left in state must
// never show up as a Classic 4-3-3 here.
const isClassicFor = (code: string) => state.value?.formationCode === code && !!state.value && gameMode(state.value) === 'classic';

if (formation.value && !isClassicFor(formation.value.code)) {
    if (import.meta.server) {
        startGame(formation.value.code);
    } else {
        resolvedOnClient = true;

        if (!resumeGame(formation.value.code)) {
            startGame(formation.value.code);
        }
    }
}

// After SSR hydration, restores whatever was persisted for the current
// formation, if anything was — a hard refresh mid-game would otherwise show
// the server's fresh game in place of every filled slot.
onMounted(() => {
    if (resolvedOnClient) {
        // resumeGame()/startGame() above already refreshed the odds.
        return;
    }

    if (formation.value) {
        resumeGame(formation.value.code);
    }

    // startGame()'s own refreshWinOdds() call above no-ops server-side, and
    // when the client hydrates into a state that already matches (the
    // common case), that whole block is skipped client-side too — so a
    // brand new game's very first odds would otherwise never be fetched.
    // resumeGame() only refreshes on an actual persisted-game match, not
    // this "nothing to resume, keep the fresh SSR state" case, so this needs
    // its own explicit call rather than relying on either of the above.
    void refreshWinOdds();
});

const remainingSlots = computed(() => state.value?.slots.filter((slot) => !slot.player).length ?? 0);
const gameOver = computed(() => (
    state.value?.status === 'won' || state.value?.status === 'bust' || state.value?.status === 'finished'
));

// Desktop: the inline picker leaves the pitch clickable, so another slot
// switches the picker — closing first keeps the old slot's offer.
function handleSlotSelect(slotId: string): void {
    if (state.value?.activeSlotId && state.value.activeSlotId !== slotId) {
        closeDialog();
    }

    openSlot(slotId);
}

const infoOpen = ref(false);
const statsOpen = ref(false);

function openInfo(source = 'play'): void {
    infoOpen.value = true;
    trackEvent('view_how_to_play', { source, formation: formationCode.value });
}

function openStats(): void {
    statsOpen.value = true;
    trackEvent('view_stats', { source: 'play', formation: formationCode.value });
}

usePageSeoMeta({
    title: () => (formation.value ? `${formation.value.code} formation — Exact XI` : 'Exact XI'),
    description: () => (formation.value
        ? `Fill the ${formation.value.code} XI and try to land your total goals plus assists exactly on ${formation.value.target} — real top-flight players since 2016/17.`
        : 'A line-up guessing game for England\'s top-flight football since 2016/17.'),
});
</script>

<template>
    <main class="play">
        <AppHeader>
            <button aria-label="How to play" class="app-header-button" type="button" @click="openInfo()">
                <AppIcon name="info" />
            </button>
            <button aria-label="Your stats" class="app-header-button" type="button" @click="openStats">
                <AppIcon name="stats" />
            </button>
        </AppHeader>

        <div class="play__inner">
            <GameLayout v-if="formation && state" :over="gameOver" @rules="openInfo('play_panel')">
                <template #head>
                    <h1 class="play__title">{{ formation.code }} formation</h1>
                </template>

                <template #panel>
                    <ScoreBar
                        :remaining-slots="remainingSlots"
                        :status="state.status"
                        :target="state.target"
                        :total="state.total"
                    />

                    <WinOddsBanner v-if="!gameOver" />

                    <ResultPanel v-if="gameOver" />

                    <p v-if="drawError" aria-live="polite" class="play__draw-error">
                        {{ drawErrorMessage }}
                    </p>

                    <PlayerChoiceDialog v-if="state.activeSlotId" :key="isWide ? 'inline' : 'modal'" :inline="isWide" />
                    <GamePanelIdle v-else-if="isWide && state.status === 'playing' && !pendingSlotId" mode="classic" />
                </template>

                <template #board>
                    <div class="game-board">
                        <Pitch />
                        <PositionSlot
                            v-for="slot in state.slots"
                            :key="slot.id"
                            :busy="isDrawing || gameOver || (isWide && pickerBusy)"
                            :game-over="gameOver"
                            :active="state.activeSlotId === slot.id"
                            :loading="pendingSlotId === slot.id"
                            :slot-data="slot"
                            @select="handleSlotSelect"
                        />
                    </div>
                </template>
            </GameLayout>

            <p v-else class="play__error">
                <template v-if="formationCode">"{{ formationCode }}" isn't a valid formation.</template>
                <template v-else>No formation selected.</template>
                <NuxtLink to="/select-formation">Pick a formation</NuxtLink>
            </p>
        </div>

        <InfoDialog v-model:open="infoOpen" />
        <StatsDialog v-model:open="statsOpen" />
    </main>
</template>

<style lang="scss" scoped>
// Mobile-first single column. On a desktop-width viewport, .play__inner caps
// out at a comfortable portrait-card width and centers itself, rather than
// letting the title/scorebar/board spread apart across the full viewport.
// AppHeader is a direct child here (not nested inside .play__inner) so it's
// sized by its own max-width, not this page's narrower one — see
// AppHeader.vue for why that matters.
// flex: 1 0 auto fills app.vue's safe-area-padded shell instead of a
// min-height: 100vh, which (added to that padding) would scroll by the
// notch/home-bar height in the iOS app.
.play {
    align-items: center;
    box-sizing: border-box;
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem 1rem 2rem;

    // The header keeps today's width on tablet (it's hidden on desktop).
    --header-max: 36rem;
}

.play__inner {
    align-items: center;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-width: 26rem;
    width: 100%;
}

@media (width >= 768px) {
    .play__inner {
        max-width: var(--game-max);
    }
}

@media (width >= 1024px) {
    .play {
        padding: 2rem 2rem 4rem;
    }

    .play__inner {
        max-width: none;
    }
}

// The formation as the screen's big display heading, like the handbook's
// pitch mockup ("4-3-3"), left-aligned over the scoreboard.
.play__title {
    align-self: stretch;
    font-size: 2rem;
    margin: 0.25rem 0 0;
}

.play__error {
    color: var(--color-muted);
    padding-top: 3rem;
    text-align: center;
}

// Errors are amber, never red (red is celebratory in Bib & Board).
.play__draw-error {
    background-color: color-mix(in srgb, var(--color-amber) 12%, var(--color-surface));
    border: 1px solid color-mix(in srgb, var(--color-amber) 40%, transparent);
    border-radius: var(--radius-md);
    box-sizing: border-box;
    color: var(--color-foreground);
    font-size: 0.85rem;
    font-weight: 600;
    margin: 0;
    padding: 0.6rem 0.75rem;
    text-align: center;
    width: 100%;
}
</style>
