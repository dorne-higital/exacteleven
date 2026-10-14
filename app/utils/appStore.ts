// App Store identifiers for the iOS app (bundle uk.co.exacteleven.app, App
// Store Connect app 6822345356). Each one already exists with exactly this ID
// in App Store Connect, and the products/entitlements in RevenueCat — they are
// permanent, so never rename them. Same layout as Footballdle's appStore.ts.

// App Store Connect "Product ID" values. Loaded by ID with
// Purchases.getProducts (no RevenueCat offerings).
export const PRODUCT_IDS = {
    pro: 'xpro', // non-consumable: Pro
    boosts5: 'xb5', // consumable: +5 boosts
    boosts15: 'xb15', // consumable: +15 boosts
    boosts40: 'xb40', // consumable: +40 boosts
    kitBag: 'xkit', // non-consumable: Kit Bag themes
    tipSmall: 'xts', // consumable tip (thank-you only, no gameplay)
    tipMedium: 'xtm',
    tipLarge: 'xtl',
} as const;

export type ProductId = (typeof PRODUCT_IDS)[keyof typeof PRODUCT_IDS];

export const ALL_PRODUCT_IDS: ProductId[] = Object.values(PRODUCT_IDS);

// RevenueCat entitlement identifiers. 'pro' comes from xpro; 'themes' from
// either xpro or xkit.
export const ENTITLEMENTS = {
    pro: 'pro',
    themes: 'themes',
} as const;

// Consumable boost packs: how many boosts each product adds to the bank.
export const BOOST_PACKS: { id: ProductId; count: number }[] = [
    { id: PRODUCT_IDS.boosts5, count: 5 },
    { id: PRODUCT_IDS.boosts15, count: 15 },
    { id: PRODUCT_IDS.boosts40, count: 40 },
];

export const TIP_PRODUCT_IDS: ProductId[] = [PRODUCT_IDS.tipSmall, PRODUCT_IDS.tipMedium, PRODUCT_IDS.tipLarge];

export function boostPackCount(productId: string): number {
    return BOOST_PACKS.find(pack => pack.id === productId)?.count ?? 0;
}

export function isTipProduct(productId: string): boolean {
    return (TIP_PRODUCT_IDS as string[]).includes(productId);
}

// Game Center leaderboard IDs (classic, high-to-low, integer). Locked once
// created in App Store Connect.
export const LEADERBOARD_IDS = {
    dailyBestStreak: 'exactxi.daily.best_streak', // stats best daily streak
    classicExactWins: 'exactxi.classic.exact_wins', // unassisted exact Classic wins
    classicBestRun: 'exactxi.classic.best_run', // best run of consecutive exact Classic wins
} as const;

export type LeaderboardId = (typeof LEADERBOARD_IDS)[keyof typeof LEADERBOARD_IDS];
