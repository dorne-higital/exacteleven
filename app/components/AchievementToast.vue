<script setup lang="ts">
import { buildShareCardBlob, shareOrDownloadBlob } from '../utils/share-card';
import { trackEvent } from '../utils/analytics';

// No existing toast/snackbar component in this app — every other
// notification is a blocking CenteredDialog, which would mean stacking a
// second modal on top of PlayerChoiceDialog at the exact moment a
// game-ending pick also unlocks a badge. This is deliberately non-modal.
const { newlyUnlocked, dismissUnlocked } = useStats();
const siteConfig = useSiteConfig();

const current = computed(() => newlyUnlocked.value[0] ?? null);

const AUTO_DISMISS_MS = 6000;
let dismissTimeout: number | undefined;

function clearDismissTimer(): void {
    if (dismissTimeout !== undefined) {
        window.clearTimeout(dismissTimeout);
        dismissTimeout = undefined;
    }
}

watch(current, (def) => {
    clearDismissTimer();

    if (def) {
        dismissTimeout = window.setTimeout(dismissUnlocked, AUTO_DISMISS_MS);
    }
});

onUnmounted(clearDismissTimer);

const shareLabel = ref('Share');
const sharing = ref(false);
let shareLabelTimeout: number | undefined;

async function handleShare(): Promise<void> {
    const def = current.value;

    if (!def || sharing.value) {
        return;
    }

    sharing.value = true;
    clearDismissTimer();

    try {
        const blob = await buildShareCardBlob({
            heading: def.label,
            subheading: `${def.rank} achievement unlocked`,
            highlight: { label: 'Threshold', value: String(def.threshold) },
            lines: [def.description, siteConfig.url],
        });

        if (blob) {
            const result = await shareOrDownloadBlob(blob, `exact-xi-${def.id}.png`, {
                title: def.label,
                text: `${def.label} unlocked on Exact XI.`,
            });

            shareLabel.value = result === 'shared' ? 'Shared!' : 'Saved!';
            trackEvent('achievement_share', { achievementId: def.id, result });
        }
    } catch {
        // Share sheet dismissed, or a permissions/canvas failure — this is an
        // optional flourish, so fail silently rather than showing an error.
    } finally {
        sharing.value = false;
        window.clearTimeout(shareLabelTimeout);
        shareLabelTimeout = window.setTimeout(() => {
            shareLabel.value = 'Share';
        }, 2000);
        dismissTimeout = window.setTimeout(dismissUnlocked, AUTO_DISMISS_MS);
    }
}

function handleDismiss(): void {
    clearDismissTimer();
    dismissUnlocked();
}
</script>

<template>
    <Transition name="achievement-toast">
        <div v-if="current" aria-live="polite" class="achievement-toast" role="status">
            <AchievementBadge :category="current.category" :rank="current.rank" :threshold="current.threshold" unlocked />

            <div class="achievement-toast__info">
                <p class="achievement-toast__eyebrow">Achievement unlocked</p>
                <p class="achievement-toast__label">{{ current.label }}</p>
            </div>

            <div class="achievement-toast__actions">
                <button class="achievement-toast__share" type="button" @click="handleShare">{{ shareLabel }}</button>
                <button aria-label="Dismiss" class="achievement-toast__dismiss" type="button" @click="handleDismiss">
                    <AppIcon name="close" />
                </button>
            </div>
        </div>
    </Transition>
</template>

<style lang="scss" scoped>
// Bib & Board toast: a flat surface card with a hairline and a red left
// edge (unlocking a badge is a celebratory moment, so it earns the bib
// red). Sits above the iOS home bar via the safe-area inset.
.achievement-toast {
    align-items: center;
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-left: 4px solid var(--color-bib);
    border-radius: var(--radius-card);
    bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
    box-shadow: var(--shadow-lg);
    box-sizing: border-box;
    color: var(--color-foreground);
    display: flex;
    gap: 0.75rem;
    left: 50%;
    max-width: 24rem;
    padding: 0.6rem 0.6rem 0.6rem 0.8rem;
    position: fixed;
    transform: translateX(-50%);
    transition: opacity 0.25s ease, transform 0.25s ease;
    width: calc(100% - 2rem - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px));
    z-index: 50;
}

.achievement-toast-enter-from,
.achievement-toast-leave-to {
    opacity: 0;
    transform: translateX(-50%) translateY(0.75rem);
}

@media (prefers-reduced-motion: reduce) {
    .achievement-toast {
        transition: opacity 0.25s ease;
    }

    .achievement-toast-enter-from,
    .achievement-toast-leave-to {
        transform: translateX(-50%);
    }
}

.achievement-toast__info {
    flex-grow: 1;
    min-width: 0;
}

.achievement-toast__eyebrow {
    color: var(--color-muted);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    margin: 0;
    text-transform: uppercase;
}

.achievement-toast__label {
    font-family: var(--font-display);
    font-size: 1.2rem;
    font-weight: 800;
    letter-spacing: 0.01em;
    line-height: 1.1;
    margin: 0.1rem 0 0;
    overflow: hidden;
    text-overflow: ellipsis;
    text-transform: var(--display-text-transform);
    white-space: nowrap;
}

.achievement-toast__actions {
    align-items: center;
    display: flex;
    flex-shrink: 0;
    gap: 0.25rem;
}

// Sharing a just-unlocked badge is this toast's one call to action, so it
// gets the red CTA treatment.
.achievement-toast__share {
    background-color: var(--color-bib);
    border: none;
    border-radius: var(--radius-md);
    color: var(--color-on-bib);
    cursor: pointer;
    font: inherit;
    font-size: 0.8rem;
    font-weight: 800;
    min-height: var(--tap-min);
    padding: 0 0.9rem;
    white-space: nowrap;
}

.achievement-toast__share:hover {
    background-color: color-mix(in srgb, var(--color-bib) 88%, var(--color-foreground));
}

.achievement-toast__dismiss {
    align-items: center;
    background: none;
    border: none;
    border-radius: var(--radius-pill);
    color: var(--color-muted);
    cursor: pointer;
    display: flex;
    height: var(--tap-min);
    justify-content: center;
    padding: 0;
    width: var(--tap-min);
}

.achievement-toast__dismiss:hover {
    background-color: var(--color-surface-2);
    color: var(--color-foreground);
}
</style>
