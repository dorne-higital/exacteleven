// The Daily 2.0 key-value store: Netlify Blobs (store "exact-xi-daily",
// strong consistency) on Netlify, an in-memory map everywhere else — local
// dev, CI and tests — the same switch the rate limiter uses in
// nuxt.config.ts, since Blobs has no local emulation without the Netlify CLI.
// Everything Daily 2.0 keeps (frozen puzzles, run records, score histograms)
// goes through this one small interface, so the routes and tests never touch
// @netlify/blobs directly.

export interface DailyKv {
    getJSON<T>(key: string): Promise<{ value: T; etag: string } | null>;
    setJSON(key: string, value: unknown, opts?: { onlyIfNew?: boolean; onlyIfMatch?: string }): Promise<{ modified: boolean; etag?: string }>;
}

const STORE_NAME = 'exact-xi-daily';

/** A process-local DailyKv with real etag / onlyIfNew / onlyIfMatch semantics. */
export function createMemoryKv(): DailyKv {
    const entries = new Map<string, { json: string; etag: string }>();
    let version = 0;

    return {
        async getJSON<T>(key: string) {
            const entry = entries.get(key);

            return entry ? { value: JSON.parse(entry.json) as T, etag: entry.etag } : null;
        },
        async setJSON(key, value, opts = {}) {
            const existing = entries.get(key);

            if (opts.onlyIfNew && existing) {
                return { modified: false };
            }

            if (opts.onlyIfMatch !== undefined && existing?.etag !== opts.onlyIfMatch) {
                return { modified: false };
            }

            version += 1;

            const etag = `"m${version}"`;

            entries.set(key, { json: JSON.stringify(value), etag });

            return { modified: true, etag };
        },
    };
}

type BlobStore = {
    getWithMetadata(key: string, options: { type: 'json'; consistency?: 'strong' | 'eventual' }): Promise<{ data: unknown; etag?: string } | null>;
    setJSON(key: string, data: unknown, options?: { onlyIfNew?: boolean; onlyIfMatch?: string }): Promise<{ modified: boolean; etag?: string }>;
};

// Netlify Blobs, loaded lazily so nothing off-Netlify (or in tests) ever
// imports it. If the Blobs environment turns out to be missing at runtime,
// it degrades to the memory store with a logged warning rather than 500ing
// every Daily request.
function createBlobsKv(fallback: () => DailyKv): DailyKv {
    let storePromise: Promise<BlobStore | null> | null = null;

    const store = (): Promise<BlobStore | null> => {
        storePromise ??= import('@netlify/blobs')
            .then(({ getStore }) => getStore({ name: STORE_NAME, consistency: 'strong' }) as unknown as BlobStore)
            .catch((error: unknown) => {
                console.error('[daily2-store] Netlify Blobs unavailable, using memory:', error);

                return null;
            });

        return storePromise;
    };

    return {
        async getJSON<T>(key: string) {
            const blobs = await store();

            if (!blobs) {
                return fallback().getJSON<T>(key);
            }

            const result = await blobs.getWithMetadata(key, { type: 'json', consistency: 'strong' });

            return result ? { value: result.data as T, etag: result.etag ?? '' } : null;
        },
        async setJSON(key, value, opts = {}) {
            const blobs = await store();

            if (!blobs) {
                return fallback().setJSON(key, value, opts);
            }

            const options = opts.onlyIfNew ? { onlyIfNew: true } : opts.onlyIfMatch !== undefined ? { onlyIfMatch: opts.onlyIfMatch } : {};
            const result = await blobs.setJSON(key, value, options);

            return { modified: result.modified, etag: result.etag };
        },
    };
}

let memoised: DailyKv | null = null;
let memoryFallback: DailyKv | null = null;
let testOverride: DailyKv | null = null;

// Checked at RUNTIME (the rate limiter's switch in nuxt.config.ts is
// build-time). Nitro's netlify preset deploys Functions v2, where the Blobs
// context arrives as globalThis.netlifyBlobsContext (and the `Netlify`
// global exists) — NETLIFY itself is a build-environment variable and may be
// absent inside the function, so it's only one of the signals.
function onNetlify(): boolean {
    const runtime = globalThis as { netlifyBlobsContext?: unknown; Netlify?: unknown };

    return Boolean(process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT || runtime.netlifyBlobsContext || runtime.Netlify);
}

/** The Daily store: Blobs on Netlify, memory elsewhere. Memoised per server instance. */
export function dailyKv(): DailyKv {
    if (testOverride) {
        return testOverride;
    }

    if (!memoised) {
        const fallback = (): DailyKv => (memoryFallback ??= createMemoryKv());

        memoised = onNetlify() ? createBlobsKv(fallback) : fallback();
    }

    return memoised;
}

/** Tests inject a fresh memory store (or a wrapper around one); null restores the default. */
export function setDailyKvForTests(kv: DailyKv | null): void {
    testOverride = kv;
}
