// Pure helpers for the shop sheet (components/ShopSheet.vue): the per-boost
// price under each pack, and which pack is the best value. Prices come from
// the App Store already localized (priceString); these only divide the raw
// price, formatted in the same currency.

export interface PricedPack {
    id: string;
    price: number;
    currencyCode: string;
    boosts?: number;
}

export function formatPrice(amount: number, currencyCode: string, locale?: string): string {
    try {
        return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode }).format(amount);
    } catch {
        // An unknown currency code: a plain number still tells the story.
        return amount.toFixed(2);
    }
}

/** "£0.20 each" for a pack, or '' when it has no price or boost count. */
export function perBoostLabel(pack: PricedPack, locale?: string): string {
    if (!pack.boosts || !(pack.price > 0) || !pack.currencyCode) {
        return '';
    }

    return `${formatPrice(pack.price / pack.boosts, pack.currencyCode, locale)} each`;
}

/** The pack with the lowest price per boost (null with fewer than two to compare). */
export function bestValuePackId(packs: PricedPack[]): string | null {
    const priced = packs.filter((pack) => pack.boosts && pack.price > 0);

    if (priced.length < 2) {
        return null;
    }

    return priced.reduce((best, pack) => (pack.price / pack.boosts! < best.price / best.boosts! ? pack : best)).id;
}
