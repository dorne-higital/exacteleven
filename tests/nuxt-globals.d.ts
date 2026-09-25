// Minimal ambient types for the Nuxt auto-imports used by composables under
// test (useGame.ts, useStats.ts, analytics.ts) — tsconfig.scripts.json is a
// deliberately standalone config (see its own comment) with no access to
// Nuxt's generated ambient globals, so any file it type-checks that touches
// these names needs them declared somewhere in its program. This file is
// that somewhere; the real runtime values are supplied per-test via
// vi.stubGlobal (see tests/useGame.test.ts) — these declarations only need
// to be accurate enough to type-check, not to run.
import type { Ref } from 'vue';

declare global {
    function useState<T>(key: string, init?: () => T): Ref<T>;
    function useStats(): ReturnType<typeof import('../app/composables/useStats').useStats>;
    const $fetch: <T = unknown>(request: string, options?: Record<string, unknown>) => Promise<T>;

    interface ImportMeta {
        readonly client?: boolean;
        readonly server?: boolean;
    }

    // Nitro/H3 auto-imports used by server/api/*.ts route handlers under
    // test (tests/api-routes.test.ts) — same reasoning as the client-side
    // globals above: stubbed at runtime per test, declared here only so this
    // standalone tsconfig can type-check the files that use them.
    function defineEventHandler<T>(handler: (event: unknown) => T): (event: unknown) => T;
    function getQuery(event: unknown): Record<string, unknown>;
    function readBody<T>(event: unknown): Promise<T>;
    function createError(options: { statusCode: number; statusMessage?: string; data?: unknown }): Error;
    function useRuntimeConfig(): { drawTokenSecret: string };
}

export {};
