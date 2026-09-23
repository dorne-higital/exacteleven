// The API routes only ever throw expected createError() 400/403/404s for bad
// input or a rejected anti-peek token — those are normal, not bugs. Anything
// else (a genuine unhandled exception, a 500) previously vanished entirely:
// Cloudflare Pages has no persistent log retention without a paid Logpush
// add-on, so without this hook a real production failure would be invisible.
// console.error here is at least streamable live via
// `wrangler pages deployment tail`, and shows up directly in `yarn dev`.
export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('error', (error, { event } = {}) => {
        const statusCode = (error as { statusCode?: number }).statusCode;

        if (statusCode && statusCode < 500) {
            return;
        }

        console.error(`[unhandled] ${event?.path ?? 'unknown path'}:`, error);
    });
});
