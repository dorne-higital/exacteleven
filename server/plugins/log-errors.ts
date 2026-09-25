// The API routes only ever throw expected createError() 400/403/404s for bad
// input or a rejected anti-peek token — those are normal, not bugs. Anything
// else (a genuine unhandled exception, a 500) previously vanished entirely:
// Netlify's function logs only keep a limited retention window (Deploys ->
// Functions in the site dashboard, or `netlify logs:function <name>` via the
// CLI), so without this hook a real production failure would be invisible.
// console.error here is at least captured there, and shows up directly in
// `yarn dev`.
export default defineNitroPlugin((nitroApp) => {
    nitroApp.hooks.hook('error', (error, { event } = {}) => {
        const statusCode = (error as { statusCode?: number }).statusCode;

        if (statusCode && statusCode < 500) {
            return;
        }

        console.error(`[unhandled] ${event?.path ?? 'unknown path'}:`, error);
    });
});
