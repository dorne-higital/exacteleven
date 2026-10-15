import { utcDateString } from '#shared/app-config';
import { nextUkMidnight, ukDateString } from '#shared/uk-date';
import type { AppConfig } from '#shared/app-config';

// Read by the iOS app on launch/resume (and harmless for anyone else):
// - minBuild / latestBuild drive the "please update" prompt — set them with
//   NUXT_APP_MIN_BUILD / NUXT_APP_LATEST_BUILD on Netlify, no code change.
// - storeUrl is where that prompt's button goes (NUXT_APP_STORE_URL).
// - serverTime / dailyDate are a trusted clock, so moving the phone's clock
//   can't preview or replay a Daily (see app/utils/trusted-date.ts).
// - ukDate / nextDailyAt (Daily 2.0): the Daily's date on the UK calendar and
//   when the next one starts (UK midnight). dailyDate keeps meaning UTC.
// Additive: new fields may be added later, existing ones keep their meaning.
export default defineEventHandler((event): AppConfig => {
    const config = useRuntimeConfig();
    const now = new Date();

    // Never cached — a stale copy would hand out a stale clock and hide a
    // newly raised minBuild.
    setResponseHeader(event, 'cache-control', 'no-store');

    return {
        minBuild: Number(config.appMinBuild) || 0,
        latestBuild: Number(config.appLatestBuild) || 0,
        serverTime: now.toISOString(),
        dailyDate: utcDateString(now),
        storeUrl: String(config.appStoreUrl || ''),
        ukDate: ukDateString(now),
        nextDailyAt: nextUkMidnight(now).toISOString(),
    };
});
