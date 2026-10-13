// The /api/app-config response — shared so the server route and the app's
// reader (app/utils/app-config.ts) can't drift. Additive only: shipped app
// builds read these fields, so never rename or repurpose one.
export interface AppConfig {
    /** Any installed app build number below this must update before playing. 0 = no minimum. */
    minBuild: number;
    /** The newest build number on the App Store (0 = unknown) — lets the app offer, not force, an update. */
    latestBuild: number;
    /** The server's clock, ISO 8601. */
    serverTime: string;
    /** The UTC calendar date (YYYY-MM-DD) the server considers "today". */
    dailyDate: string;
    /** Where the update prompt sends people (the App Store listing); '' = not live yet. Added after v1, so optional. */
    storeUrl?: string;
}

export function utcDateString(date: Date): string {
    return date.toISOString().slice(0, 10);
}
