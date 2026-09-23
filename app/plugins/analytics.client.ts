import { trackEvent } from '../utils/analytics';

// GTM's own container only fires its default page_view once, on initial
// load — this is a real SPA (Vue Router client-side navigation) after that,
// so without this every /play or / visit past the first would be invisible
// to GA4. Fired from a route-level afterEach rather than per-page useHead
// calls so it's one place, not one per page.
export default defineNuxtPlugin(() => {
    const router = useRouter();

    // GTM's built-in "Page Title"/"Page URL" variables read document.title
    // and location at event time, so this just needs to fire the event —
    // no need to pass title through manually.
    router.afterEach((to) => {
        trackEvent('page_view', { page_path: to.fullPath });
    });
});
