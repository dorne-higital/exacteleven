type SeoValue = string | (() => string);

interface PageSeoMetaOptions {
    title: SeoValue;
    description: SeoValue;
    /** Defaults to `title` when omitted — every page so far only diverges for the home page. */
    ogTitle?: SeoValue;
    ogDescription?: SeoValue;
    twitterTitle?: SeoValue;
    twitterDescription?: SeoValue;
}

// Every page shares the same OG image and Twitter card shape — this factors
// that boilerplate out so a page only ever states what's actually its own
// (title/description, and occasionally a shorter og/twitter variant).
export function usePageSeoMeta(options: PageSeoMetaOptions): void {
    useSeoMeta({
        title: options.title,
        description: options.description,
        ogTitle: options.ogTitle ?? options.title,
        ogDescription: options.ogDescription,
        ogImage: '/og-image.png',
        ogImageWidth: 1200,
        ogImageHeight: 630,
        ogImageAlt: 'Exact XI logo on a dark background',
        twitterCard: 'summary_large_image',
        twitterTitle: options.twitterTitle,
        twitterDescription: options.twitterDescription,
        twitterImage: '/og-image.png',
    });
}
