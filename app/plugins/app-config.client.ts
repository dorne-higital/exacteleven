import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { fetchAppConfig, updateReason } from '../utils/app-config';
import type { UpdateReason } from '../utils/app-config';
import { trackEvent } from '../utils/analytics';

// iOS app only: on launch and on every resume, reads /api/app-config and
// compares its minBuild / latestBuild with the installed build number. Below
// either one, it raises the update prompt (components/UpdatePrompt.vue)
// through the 'update-prompt' state. Never blocks play — the API is additive,
// so an old build keeps working; the prompt just says so.
// - 'required' (below minBuild): shown once per app session.
// - 'available' (below latestBuild): shown at most once a day.
export interface UpdatePromptState {
    reason: UpdateReason;
    storeUrl: string;
}

const DAILY_KEY = 'exact-xi-update-prompt';

function shownToday(): boolean {
    try {
        return localStorage.getItem(DAILY_KEY) === new Date().toDateString();
    } catch {
        return false;
    }
}

function rememberShownToday(): void {
    try {
        localStorage.setItem(DAILY_KEY, new Date().toDateString());
    } catch {
        // Storage blocked: it'll just show again tomorrow-or-sooner.
    }
}

export default defineNuxtPlugin(() => {
    if (!Capacitor.isNativePlatform()) {
        return;
    }

    const prompt = useState<UpdatePromptState | null>('update-prompt', () => null);
    let shownRequired = false;

    async function check(fresh: boolean): Promise<void> {
        const config = await fetchAppConfig({ fresh });
        if (!config || prompt.value) {
            return;
        }

        let build: number;
        try {
            // getInfo() resolves plain data; it's the plugin proxy itself
            // that must never be awaited (r1 plan 6.10).
            build = Number((await App.getInfo()).build);
        } catch {
            return;
        }

        const reason = updateReason(build, config);
        if (!reason || (reason === 'required' && shownRequired) || (reason === 'available' && shownToday())) {
            return;
        }

        if (reason === 'required') {
            shownRequired = true;
        } else {
            rememberShownToday();
        }

        prompt.value = { reason, storeUrl: config.storeUrl ?? '' };
        trackEvent('update_prompt_shown', { source: reason });
    }

    check(false);
    App.addListener('resume', () => {
        check(true);
    }).catch(() => {});
});
