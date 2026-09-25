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
.achievement-toast {
    align-items: center;
    background-color: var(--color-surface);
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-sharp);
    bottom: calc(1.25rem + env(safe-area-inset-bottom, 0px));
    box-shadow: 0 12px 32px rgb(0 0 0 / 35%);
    display: flex;
    gap: 0.75rem;
    left: 50%;
    max-width: 22rem;
    padding: 0.75rem 0.85rem;
    position: fixed;
    transform: translateX(-50%);
    transition: opacity 0.25s ease, transform 0.25s ease;
    width: calc(100% - 2.5rem);
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
    color: var(--color-primary);
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    margin: 0;
    text-transform: uppercase;
}

.achievement-toast__label {
    font-family: var(--font-display);
    font-size: 1rem;
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
    gap: 0.4rem;
}

// The ticket-stub CTA — sharing a just-unlocked badge is a real call to
// action, same reasoning as ResultPanel's primary button.
.achievement-toast__share {
    background-color: var(--color-primary);
    border: none;
    border-radius: var(--radius-stub);
    color: var(--color-background);
    cursor: pointer;
    font: inherit;
    font-size: 0.75rem;
    font-weight: 700;
    padding: 0.4rem 0.65rem;
    white-space: nowrap;
}

.achievement-toast__dismiss {
    background: none;
    border: none;
    color: color-mix(in srgb, var(--color-foreground) 65%, transparent);
    cursor: pointer;
    display: flex;
    padding: 0.3rem;
}
</style>
