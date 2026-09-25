<script setup lang="ts">
import type { ChallengePayload } from '../composables/useGame';
import type { FormationCode, ObjectiveKind } from '../../shared/types';
import { objectiveValueOptions } from '#shared/daily';
import { trackEvent } from '../utils/analytics';
import { buildChallengeQuery } from '../utils/challenge-config';
import { formations, getSlotShortLabel } from '../utils/formations';

const open = defineModel<boolean>('open', { default: false });

const siteConfig = useSiteConfig();

const MAX_PRESET_SLOTS = 3;

const MODE_OPTIONS: Array<{ kind: ObjectiveKind; label: string }> = [
    { kind: 'exact', label: 'Exact' },
    { kind: 'over', label: 'Over' },
    { kind: 'under', label: 'Under' },
    { kind: 'allUnder', label: 'All under' },
];

const formationCode = ref<FormationCode>('442');
const mode = ref<ObjectiveKind>('exact');
const value = ref<number | null>(null);
const presetSlotIds = ref<string[]>([]);

const formation = computed(() => formations.find((candidate) => candidate.code === formationCode.value)!);
const nonGkSlots = computed(() => formation.value.slots.filter((slot) => slot.group !== 'GK'));
const valueOptions = computed(() => objectiveValueOptions(mode.value));

// A formation/mode change can leave stale selections behind (a preset slot
// id from the previous formation, or a value from a different mode's
// catalog) — clearing both keeps every combination always valid rather than
// needing to reconcile stale state on every read.
watch(formationCode, () => {
    presetSlotIds.value = [];
});

watch(mode, (kind) => {
    value.value = kind === 'exact' ? null : (objectiveValueOptions(kind)[0] ?? null);
});

function toggleSlot(slotId: string): void {
    if (presetSlotIds.value.includes(slotId)) {
        presetSlotIds.value = presetSlotIds.value.filter((id) => id !== slotId);

        return;
    }

    if (presetSlotIds.value.length >= MAX_PRESET_SLOTS) {
        return;
    }

    presetSlotIds.value = [...presetSlotIds.value, slotId];
}

type Step = 'configuring' | 'loading' | 'preview' | 'error';

const step = ref<Step>('configuring');
const preview = ref<ChallengePayload | null>(null);
const challengeUrl = ref('');

async function handleGenerate(): Promise<void> {
    step.value = 'loading';

    const query = buildChallengeQuery({
        formationCode: formationCode.value,
        mode: mode.value,
        value: value.value ?? undefined,
        presetSlotIds: presetSlotIds.value,
    });

    try {
        preview.value = await $fetch<ChallengePayload>('/api/challenge', { query });
        challengeUrl.value = `${siteConfig.url}/challenge?${new URLSearchParams(query).toString()}`;
        step.value = 'preview';
        trackEvent('challenge_created', {
            formation: formationCode.value,
            mode: mode.value,
            presetCount: presetSlotIds.value.length,
        });
    } catch {
        step.value = 'error';
    }
}

function handleStartOver(): void {
    step.value = 'configuring';
    preview.value = null;
}

const copyLabel = ref('Copy link');
let copyLabelTimeout: number | undefined;

// The "was this link actually handed to anyone" signal — challenge_created
// (above) only means a preview was generated, which can be abandoned without
// ever reaching a friend. This is the count that answers "how many links are
// being made" in the sense that matters.
function trackLinkShared(method: 'share' | 'copy'): void {
    trackEvent('challenge_link_shared', {
        formation: formationCode.value,
        mode: mode.value,
        method,
        presetCount: presetSlotIds.value.length,
    });
}

async function handleShareOrCopy(): Promise<void> {
    if (navigator.share) {
        try {
            await navigator.share({ title: 'Exact XI', text: 'A board I set up for you on Exact XI.', url: challengeUrl.value });
            trackLinkShared('share');

            return;
        } catch {
            // Dismissed the share sheet, or unsupported for this data — fall
            // through to the clipboard-copy fallback below.
        }
    }

    if (!navigator.clipboard?.writeText) {
        return;
    }

    try {
        await navigator.clipboard.writeText(challengeUrl.value);
        copyLabel.value = 'Copied!';
        window.clearTimeout(copyLabelTimeout);
        copyLabelTimeout = window.setTimeout(() => {
            copyLabel.value = 'Copy link';
        }, 2000);
        trackLinkShared('copy');
    } catch {
        // Optional convenience — fail silently, same as every other share action in this app.
    }
}

// Resets to a clean slate the next time this dialog opens, rather than
// reopening on whatever step/config was left over from last time.
watch(open, (isOpen) => {
    if (isOpen) {
        step.value = 'configuring';
        preview.value = null;
        formationCode.value = '442';
        mode.value = 'exact';
        value.value = null;
        presetSlotIds.value = [];
    }
});
</script>

<template>
    <CenteredDialog v-model:open="open" title="Create a challenge">
        <template v-if="step === 'configuring' || step === 'loading'">
            <p class="create-challenge__intro">
                Pick a formation and an objective, then optionally lock in a couple of players to make it harder —
                anyone who opens the link plays this exact board.
            </p>

            <div class="create-challenge__field">
                <span class="create-challenge__label">Formation</span>
                <div class="create-challenge__chips">
                    <button
                        v-for="candidate in formations"
                        :key="candidate.code"
                        class="create-challenge__chip"
                        :class="{ 'create-challenge__chip--active': candidate.code === formationCode }"
                        type="button"
                        @click="formationCode = candidate.code"
                    >
                        {{ candidate.code }}
                    </button>
                </div>
            </div>

            <div class="create-challenge__field">
                <span class="create-challenge__label">Objective</span>
                <div class="create-challenge__chips">
                    <button
                        v-for="option in MODE_OPTIONS"
                        :key="option.kind"
                        class="create-challenge__chip"
                        :class="{ 'create-challenge__chip--active': option.kind === mode }"
                        type="button"
                        @click="mode = option.kind"
                    >
                        {{ option.label }}
                    </button>
                </div>
            </div>

            <div v-if="valueOptions.length > 0" class="create-challenge__field">
                <span class="create-challenge__label">Value</span>
                <div class="create-challenge__chips">
                    <button
                        v-for="option in valueOptions"
                        :key="option"
                        class="create-challenge__chip"
                        :class="{ 'create-challenge__chip--active': option === value }"
                        type="button"
                        @click="value = option"
                    >
                        {{ option }}
                    </button>
                </div>
            </div>

            <div class="create-challenge__field">
                <span class="create-challenge__label">Pre-fill slots (up to {{ MAX_PRESET_SLOTS }}, optional)</span>
                <div class="create-challenge__chips">
                    <button
                        v-for="slot in nonGkSlots"
                        :key="slot.id"
                        class="create-challenge__chip"
                        :class="{ 'create-challenge__chip--active': presetSlotIds.includes(slot.id) }"
                        :disabled="!presetSlotIds.includes(slot.id) && presetSlotIds.length >= MAX_PRESET_SLOTS"
                        type="button"
                        @click="toggleSlot(slot.id)"
                    >
                        {{ getSlotShortLabel(slot.group, slot.side, slot.rowSize) }}
                    </button>
                </div>
            </div>

            <button class="create-challenge__generate" :disabled="step === 'loading'" type="button" @click="handleGenerate">
                {{ step === 'loading' ? 'Building…' : 'Get link' }}
            </button>
        </template>

        <template v-else-if="step === 'preview' && preview">
            <p class="create-challenge__intro">
                {{ preview.formationCode }} · {{ preview.objective.label }}
            </p>

            <ul v-if="preview.prefilled.length > 0" class="create-challenge__preview-list">
                <li v-for="entry in preview.prefilled" :key="entry.slotId" class="create-challenge__preview-item">
                    {{ entry.player.name }} — {{ entry.player.goals + entry.player.assists }}
                </li>
            </ul>
            <p v-else class="create-challenge__preview-empty">No pre-filled slots — a clean board with a twist.</p>

            <code class="create-challenge__link">{{ challengeUrl }}</code>

            <div class="create-challenge__preview-actions">
                <button class="create-challenge__generate" type="button" @click="handleShareOrCopy">{{ copyLabel }}</button>
                <button class="create-challenge__start-over" type="button" @click="handleStartOver">Start over</button>
            </div>
        </template>

        <template v-else-if="step === 'error'">
            <p class="create-challenge__intro">Couldn't build that challenge — try a different combination.</p>
            <button class="create-challenge__generate" type="button" @click="handleStartOver">Start over</button>
        </template>
    </CenteredDialog>
</template>

<style lang="scss" scoped>
.create-challenge__intro {
    color: color-mix(in srgb, var(--color-foreground) 75%, transparent);
    font-size: 0.85rem;
    line-height: 1.4;
    margin: 0 0 1rem;
}

.create-challenge__field {
    margin-bottom: 1rem;
}

.create-challenge__label {
    color: color-mix(in srgb, var(--color-foreground) 70%, transparent);
    display: block;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    margin-bottom: 0.4rem;
    text-transform: uppercase;
}

.create-challenge__chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
}

.create-challenge__chip {
    background: none;
    border: 1px solid color-mix(in srgb, var(--color-foreground) 20%, transparent);
    border-radius: var(--radius-sharp);
    color: inherit;
    cursor: pointer;
    font: inherit;
    font-size: 0.78rem;
    font-weight: 600;
    padding: 0.4rem 0.75rem;
}

.create-challenge__chip:disabled {
    cursor: default;
    opacity: 0.4;
}

.create-challenge__chip--active {
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    color: var(--color-background);
}

// The ticket-stub CTA — this class carries whichever action is primary
// for the current step (generate, then share/copy).
.create-challenge__generate {
    background-color: var(--color-primary);
    border: none;
    border-radius: var(--radius-stub);
    color: var(--color-background);
    cursor: pointer;
    flex: 1 1 auto;
    font: inherit;
    font-weight: 700;
    padding: 0.7rem 1rem;
    width: 100%;
}

.create-challenge__generate:disabled {
    cursor: default;
    opacity: 0.6;
}

.create-challenge__preview-list {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.85rem;
    list-style: none;
    margin: 0 0 1rem;
    padding: 0;
}

.create-challenge__preview-empty {
    color: color-mix(in srgb, var(--color-foreground) 70%, transparent);
    font-size: 0.85rem;
    margin: 0 0 1rem;
}

.create-challenge__link {
    background-color: color-mix(in srgb, var(--color-foreground) 6%, transparent);
    border-radius: var(--radius-sharp);
    display: block;
    font-size: 0.75rem;
    margin-bottom: 1rem;
    overflow-wrap: break-word;
    padding: 0.6rem 0.75rem;
}

.create-challenge__preview-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.create-challenge__start-over {
    background: none;
    border: 1px solid color-mix(in srgb, var(--color-foreground) 20%, transparent);
    border-radius: var(--radius-sharp);
    color: inherit;
    cursor: pointer;
    flex: 1 1 auto;
    font: inherit;
    padding: 0.7rem 1rem;
}
</style>
