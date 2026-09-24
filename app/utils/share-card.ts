// A hand-rolled Canvas 2D renderer — no image/canvas library exists in this
// project, and a single flexible layout covers both a game-result card and
// an achievement-unlock card, so it isn't worth adding one for this.
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

export interface ShareCardSpec {
    heading: string;
    subheading: string;
    highlight: { label: string; value: string };
    lines: string[];
}

function readCssVar(name: string, fallback: string): string {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();

    return value || fallback;
}

// Canvas has no access to CSS custom properties directly — reading them live
// at draw time (rather than hardcoding hexes) is the client-side equivalent
// of this codebase's "always use theme tokens" rule, so the exported card
// matches whichever theme the visitor is currently on.
function readTheme() {
    return {
        background: readCssVar('--color-background', '#0b0f0d'),
        foreground: readCssVar('--color-foreground', '#f5f5f0'),
        primary: readCssVar('--color-primary', '#7cfb5b'),
        displayFont: readCssVar('--font-display', 'sans-serif'),
    };
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const wrapped: string[] = [];
    let current = '';

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;

        if (ctx.measureText(candidate).width > maxWidth && current) {
            wrapped.push(current);
            current = word;
        } else {
            current = candidate;
        }
    }

    if (current) {
        wrapped.push(current);
    }

    return wrapped;
}

export async function buildShareCardBlob(spec: ShareCardSpec): Promise<Blob | null> {
    // Ensures the display font is actually loaded before it's drawn —
    // otherwise the first render can silently fall back to a generic
    // sans-serif in the exported image.
    await document.fonts.ready;

    const canvas = document.createElement('canvas');

    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;

    const ctx = canvas.getContext('2d');

    if (!ctx) {
        return null;
    }

    const theme = readTheme();
    const padding = 72;

    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    ctx.fillStyle = theme.primary;
    ctx.fillRect(0, 0, 14, CARD_HEIGHT);

    ctx.fillStyle = theme.primary;
    ctx.font = `700 32px ${theme.displayFont}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('EXACT XI', padding, 100);

    ctx.fillStyle = theme.foreground;
    ctx.font = `700 64px ${theme.displayFont}`;
    const headingLines = wrapLines(ctx, spec.heading, CARD_WIDTH - padding * 2);

    headingLines.forEach((line, index) => {
        ctx.fillText(line, padding, 210 + index * 74);
    });

    const subheadingY = 210 + headingLines.length * 74 + 20;

    ctx.font = '400 32px system-ui, sans-serif';
    ctx.fillStyle = `color-mix(in srgb, ${theme.foreground} 75%, transparent)`;
    ctx.fillText(spec.subheading, padding, subheadingY);

    ctx.fillStyle = theme.primary;
    ctx.font = `700 30px ${theme.displayFont}`;
    ctx.fillText(spec.highlight.label.toUpperCase(), padding, subheadingY + 70);

    ctx.fillStyle = theme.foreground;
    ctx.font = `700 96px ${theme.displayFont}`;
    ctx.fillText(spec.highlight.value, padding, subheadingY + 170);

    ctx.font = '400 26px system-ui, sans-serif';
    ctx.fillStyle = `color-mix(in srgb, ${theme.foreground} 65%, transparent)`;
    spec.lines.forEach((line, index) => {
        ctx.fillText(line, padding, CARD_HEIGHT - 90 + index * 34);
    });

    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
}

// If the Web Share API can take a file, use the native share sheet
// (best UX, mobile-first); otherwise fall back to a plain download so the
// visitor can attach the image wherever they like.
export async function shareOrDownloadBlob(
    blob: Blob,
    filename: string,
    shareData: { title: string; text: string },
): Promise<'shared' | 'downloaded'> {
    const file = new File([blob], filename, { type: 'image/png' });

    if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: shareData.title, text: shareData.text });

        return 'shared';
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);

    return 'downloaded';
}
