<script setup lang="ts">
import type { UpdatePromptState } from '../plugins/app-config.client';
import { trackEvent } from '../utils/analytics';

// The iOS app's "update available" dialog, raised by
// plugins/app-config.client.ts. Only mounted in the app build (app.vue).
const prompt = useState<UpdatePromptState | null>('update-prompt', () => null);

const required = computed(() => prompt.value?.reason === 'required');

// Closing any way (Later, the X, Escape, the backdrop) counts as a dismiss.
const open = computed({
    get: () => prompt.value !== null,
    set: (isOpen: boolean) => {
        if (!isOpen && prompt.value) {
            trackEvent('update_prompt_dismissed', { source: prompt.value.reason });
            prompt.value = null;
        }
    },
});

function accept(): void {
    if (prompt.value) {
        trackEvent('update_prompt_accepted', { source: prompt.value.reason });
        prompt.value = null;
    }
}
</script>

<template>
    <CenteredDialog v-model:open="open" :title="required ? 'Time to update' : 'Update available'">
        <div class="update-prompt">
            <p class="update-prompt__text">
                <template v-if="required">
                    This version of Exact XI is out of date. Update from the App Store to keep everything working.
                </template>
                <template v-else>
                    A new version of Exact XI is on the App Store.
                </template>
            </p>
            <a
                v-if="prompt?.storeUrl"
                :href="prompt.storeUrl"
                class="update-prompt__cta"
                rel="noopener"
                target="_blank"
                @click="accept"
            >Update now</a>
            <button class="update-prompt__later" type="button" @click="open = false">Later</button>
        </div>
    </CenteredDialog>
</template>

<style lang="scss" scoped>
.update-prompt {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.update-prompt__text {
    color: var(--color-muted);
    line-height: 1.5;
    margin: 0 0 0.25rem;
}

.update-prompt__cta,
.update-prompt__later {
    align-items: center;
    border-radius: var(--radius-md);
    box-sizing: border-box;
    display: flex;
    font: inherit;
    font-weight: 700;
    justify-content: center;
    min-height: var(--tap-min);
    text-decoration: none;
    width: 100%;
}

// The one red call to action on this screen.
.update-prompt__cta {
    background-color: var(--color-bib);
    color: var(--color-on-bib);
}

.update-prompt__later {
    background: none;
    border: 1px solid var(--color-line);
    color: var(--color-foreground);
    cursor: pointer;
}

.update-prompt__cta:focus-visible,
.update-prompt__later:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
}
</style>
