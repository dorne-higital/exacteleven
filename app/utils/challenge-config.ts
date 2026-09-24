import type { FormationCode, ObjectiveKind } from '../../shared/types';

export interface ChallengeConfig {
    formationCode: FormationCode;
    mode: ObjectiveKind;
    /** Required for every mode but 'exact', where the value is always derived from the formation number. */
    value?: number;
    /** 0-3 non-GK slot ids to pre-fill — validated for real server-side (see server/api/challenge.get.ts); this just builds the query. */
    presetSlotIds: string[];
}

// Builds the query object for a NuxtLink/URL to /challenge — plain flat
// params, matching this codebase's one existing query-param convention
// (play.vue's `?f=`) rather than a JSON blob.
export function buildChallengeQuery(config: ChallengeConfig): Record<string, string> {
    const query: Record<string, string> = { f: config.formationCode, mode: config.mode };

    if (config.value !== undefined) {
        query.value = String(config.value);
    }

    if (config.presetSlotIds.length > 0) {
        query.preset = config.presetSlotIds.join(',');
    }

    return query;
}

// Turns a canonical query object back into a stable string key, used only to
// tell two challenge configs apart for resume-matching (app/pages/challenge.vue)
// — the actual validation happens server-side in /api/challenge.
export function challengeKeyFromQuery(query: Record<string, string>): string {
    return Object.entries(query).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('&');
}
