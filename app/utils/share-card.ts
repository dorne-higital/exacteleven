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
    /**
     * Optional outcome flavour for the big number's chip: 'win' paints it bib
     * red (the exact-hit moment), 'bust' slate. Omitted = the plain white bib.
     */
    tone?: 'win' | 'bust';
    /**
     * Daily 2.0: the share grid, drawn on the board in place of the big
     * number — rows from attack (top) to keeper (bottom), one square per
     * player coloured by how much the pick helped. No names.
     */
    grid?: ShareCardCell[][];
}

export type ShareCardLevel = 'best' | 'good' | 'poor' | 'bust' | 'locked' | 'empty';

export interface ShareCardCell {
    level: ShareCardLevel;
    captain?: boolean;
}

function readCssVar(name: string, fallback: string): string {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();

    return value || fallback;
}

// Canvas has no access to CSS custom properties directly — reading them live
// at draw time (rather than hardcoding hexes) is the client-side equivalent
// of this codebase's "always use theme tokens" rule, so the exported card
// matches whichever theme the visitor is currently on. Fallbacks are the
// light "Bib & Board" values.
function readTheme() {
    return {
        background: readCssVar('--color-background', '#f3f5f1'),
        foreground: readCssVar('--color-foreground', '#0f1d16'),
        muted: readCssVar('--color-muted', '#5b6b62'),
        bib: readCssVar('--color-bib', '#da291c'),
        onBib: readCssVar('--color-on-bib', '#ffffff'),
        bust: readCssVar('--color-bust', '#4f5d66'),
        amber: readCssVar('--color-amber', '#b87900'),
        teal: readCssVar('--color-teal', '#0f7480'),
        pitch: readCssVar('--color-pitch', '#13865c'),
        pitchStripe: readCssVar('--color-pitch-stripe', '#0f7a53'),
        pitchLine: readCssVar('--color-pitch-line', 'rgb(255 255 255 / 55%)'),
        pitchInk: readCssVar('--color-pitch-ink', '#ffffff'),
        slotBg: readCssVar('--slot-filled-bg', '#ffffff'),
        slotInk: readCssVar('--slot-filled-ink', '#0f1d16'),
        displayFont: readCssVar('--font-display', 'sans-serif'),
        bodyFont: readCssVar('--font-body', 'system-ui, sans-serif'),
        monoFont: readCssVar('--font-mono', 'monospace'),
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

// roundRect() is missing from older WebKit (pre iOS 16); a square corner is
// an acceptable fallback there.
function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    ctx.beginPath();

    if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, width, height, radius);
    } else {
        ctx.rect(x, y, width, height);
    }
}

// The right-hand tactics board: mown stripes, thin white lines, and the
// card's big number on a round bib chip at the centre spot.
function drawBoard(
    ctx: CanvasRenderingContext2D,
    theme: ReturnType<typeof readTheme>,
    spec: ShareCardSpec,
    box: { x: number; y: number; width: number; height: number },
): void {
    const { x, y, width, height } = box;
    const stripes = 10;
    const stripeHeight = height / stripes;

    ctx.save();
    roundedRectPath(ctx, x, y, width, height, 32);
    ctx.clip();

    for (let index = 0; index < stripes; index++) {
        ctx.fillStyle = index % 2 === 0 ? theme.pitch : theme.pitchStripe;
        ctx.fillRect(x, y + index * stripeHeight, width, stripeHeight + 1);
    }

    const inset = 22;
    const centreX = x + width / 2;
    const centreY = y + height / 2;

    ctx.strokeStyle = theme.pitchLine;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + inset, y + inset, width - inset * 2, height - inset * 2);
    ctx.beginPath();
    ctx.moveTo(x + inset, centreY);
    ctx.lineTo(x + width - inset, centreY);
    ctx.stroke();
    ctx.strokeRect(centreX - 90, y + inset, 180, 70);
    ctx.strokeRect(centreX - 90, y + height - inset - 70, 180, 70);
    ctx.restore();

    if (spec.grid && spec.grid.length > 0) {
        drawGrid(ctx, theme, spec.grid, { x, y, width, height });

        ctx.fillStyle = theme.pitchInk;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `700 26px ${theme.bodyFont}`;
        ctx.fillText(spec.highlight.label.toUpperCase(), centreX, y + height - 52);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        return;
    }

    const chipRadius = 112;
    const chipFill = spec.tone === 'win' ? theme.bib : spec.tone === 'bust' ? theme.bust : theme.slotBg;
    const chipInk = spec.tone === 'win' ? theme.onBib : spec.tone === 'bust' ? theme.background : theme.slotInk;

    ctx.fillStyle = chipFill;
    ctx.beginPath();
    ctx.arc(centreX, centreY, chipRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = theme.pitchInk;
    ctx.lineWidth = 5;
    ctx.stroke();

    ctx.fillStyle = chipInk;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${spec.highlight.value.length > 3 ? 104 : 128}px ${theme.displayFont}`;
    ctx.fillText(spec.highlight.value, centreX, centreY + 6, chipRadius * 1.7);

    ctx.fillStyle = theme.pitchInk;
    ctx.font = `700 26px ${theme.bodyFont}`;
    ctx.fillText(spec.highlight.label.toUpperCase(), centreX, centreY + chipRadius + 44);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
}

// The Daily share grid on the board: the same colours as the emoji text
// share (🟥 best = bib, 🟧 good = amber, ⬜ poor = white bib, ⬛ bust =
// slate, 🟦 locked = teal, empty = an outline), with a small "C" on the
// captain's square.
function drawGrid(
    ctx: CanvasRenderingContext2D,
    theme: ReturnType<typeof readTheme>,
    rows: ShareCardCell[][],
    box: { x: number; y: number; width: number; height: number },
): void {
    const fills: Record<ShareCardLevel, string | null> = {
        best: theme.bib,
        good: theme.amber,
        poor: theme.slotBg,
        bust: theme.bust,
        locked: theme.teal,
        empty: null,
    };
    const size = 54;
    const gap = 14;
    const top = box.y + 70;
    const usable = box.height - 190;
    const step = rows.length > 1 ? usable / (rows.length - 1) : 0;

    rows.forEach((row, rowIndex) => {
        const rowWidth = row.length * size + (row.length - 1) * gap;
        const startX = box.x + (box.width - rowWidth) / 2;
        const rowY = top + rowIndex * step;

        row.forEach((cell, cellIndex) => {
            const cellX = startX + cellIndex * (size + gap);
            const fill = fills[cell.level];

            roundedRectPath(ctx, cellX, rowY, size, size, 10);

            if (fill) {
                ctx.fillStyle = fill;
                ctx.fill();
            } else {
                ctx.strokeStyle = theme.pitchLine;
                ctx.lineWidth = 3;
                ctx.stroke();
            }

            if (cell.captain) {
                ctx.fillStyle = cell.level === 'best' ? theme.onBib : theme.slotInk;
                ctx.font = `900 30px ${theme.displayFont}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText('C', cellX + size / 2, rowY + size / 2 + 2);
                ctx.textAlign = 'left';
                ctx.textBaseline = 'alphabetic';
            }
        });
    });
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
    const board = { x: 760, y: 56, width: 384, height: CARD_HEIGHT - 112 };
    const textWidth = board.x - padding * 2;

    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    // Wordmark: a small bib-red tab, then EXACT XI in the display face.
    ctx.fillStyle = theme.bib;
    roundedRectPath(ctx, padding, 74, 12, 38, 4);
    ctx.fill();

    ctx.fillStyle = theme.foreground;
    ctx.font = `900 44px ${theme.displayFont}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('EXACT XI', padding + 26, 108);

    // Display face is uppercase throughout the UI (--display-text-transform);
    // canvas has no text-transform, so it's applied here.
    ctx.fillStyle = spec.tone === 'win' ? theme.bib : theme.foreground;
    ctx.font = `900 92px ${theme.displayFont}`;
    const headingLines = wrapLines(ctx, spec.heading.toUpperCase(), textWidth).slice(0, 3);

    headingLines.forEach((line, index) => {
        ctx.fillText(line, padding, 232 + index * 86);
    });

    let cursorY = 232 + (headingLines.length - 1) * 86 + 62;

    ctx.fillStyle = theme.muted;
    ctx.font = `500 30px ${theme.bodyFont}`;
    wrapLines(ctx, spec.subheading, textWidth).slice(0, 3).forEach((line) => {
        ctx.fillText(line, padding, cursorY);
        cursorY += 40;
    });

    ctx.fillStyle = theme.muted;
    ctx.font = `500 22px ${theme.monoFont}`;
    spec.lines.forEach((line, index) => {
        ctx.fillText(line, padding, CARD_HEIGHT - 72 - (spec.lines.length - 1 - index) * 34, textWidth);
    });

    drawBoard(ctx, theme, spec, board);

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
