import type { AppConfig } from '../../shared/app-config';
import { apiFetch } from './api';

// Reads /api/app-config (see server/api/app-config.get.ts): the minimum/
// latest app build for an update prompt, and the server's clock for the
// Daily date. Resolves null rather than throwing when offline or slow —
// nothing that uses it should block play on it. The result is shared for a
// few minutes so several callers on launch make one request; pass
// `fresh: true` to bypass that (e.g. on app resume).
const TIMEOUT_MS = 4000;
const CACHE_MS = 5 * 60 * 1000;

let cached: { at: number; promise: Promise<AppConfig | null> } | null = null;

function isAppConfig(value: unknown): value is AppConfig {
    return typeof value === 'object' && value !== null
        && typeof (value as AppConfig).dailyDate === 'string'
        && typeof (value as AppConfig).serverTime === 'string';
}

export function fetchAppConfig(options: { fresh?: boolean } = {}): Promise<AppConfig | null> {
    if (!options.fresh && cached && Date.now() - cached.at < CACHE_MS) {
        return cached.promise;
    }

    const promise = apiFetch<unknown>('/api/app-config', { timeout: TIMEOUT_MS, retry: 0 })
        .then((value) => (isAppConfig(value) ? value : null))
        .catch(() => {
            // Don't remember a failure — the next caller should try again.
            if (cached?.promise === promise) {
                cached = null;
            }

            return null;
        });

    cached = { at: Date.now(), promise };

    return promise;
}

// Whether the iOS update prompt should show for this installed build:
// 'required' below minBuild, 'available' below latestBuild, else null.
// A 0 (unset) gate never prompts, and neither does an unreadable build.
export type UpdateReason = 'required' | 'available';

export function updateReason(build: number, config: Pick<AppConfig, 'minBuild' | 'latestBuild'>): UpdateReason | null {
    if (!Number.isFinite(build) || build <= 0) {
        return null;
    }

    if (config.minBuild > 0 && build < config.minBuild) {
        return 'required';
    }

    if (config.latestBuild > 0 && build < config.latestBuild) {
        return 'available';
    }

    return null;
}
