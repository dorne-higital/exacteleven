// Stateless anti-peek proof for the draw -> reveal flow (see the build
// brief's "Anti-peeking" note). A draw token is an HMAC over the player id
// PLUS the game id it was drawn for and the time it was issued, so
// /api/reveal can verify — cryptographically, without trusting the client
// and without any server-side session/game-token store — that a given
// player was genuinely offered by /api/draw earlier in THIS game, and that
// the token hasn't gone stale. Binding to a game id and expiring the token
// stops a token collected in one playthrough from being replayed or
// stockpiled indefinitely outside it; it isn't a substitute for the
// separately-tracked rate limiting needed to stop someone from farming many
// short-lived tokens across many fake game ids in quick succession.
// Uses the Web Crypto API rather than Node's `crypto` module so it doesn't
// depend on a Node-specific import — this runs the same in `yarn dev` and in
// the Netlify Functions runtime this project deploys to in production (see
// `nitro.preset` in nuxt.config.ts).
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const TOKEN_TTL_MS = 5 * 60 * 1000;

interface TokenPayload {
    playerId: string;
    gameId: string;
    issuedAt: number;
}

async function importKey(secret: string): Promise<CryptoKey> {
    return crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
}

function toHex(bytes: ArrayBuffer): string {
    return Array.from(new Uint8Array(bytes))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

function encodePayload(payload: TokenPayload): string {
    const binary = Array.from(encoder.encode(JSON.stringify(payload)), (byte) => String.fromCharCode(byte)).join('');

    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Returns null rather than throwing on anything malformed — a tampered or
// garbage payload segment should just fail verification, not 500.
function decodePayload(encoded: string): TokenPayload | null {
    try {
        const padded = encoded.replace(/-/g, '+').replace(/_/g, '/').padEnd(encoded.length + ((4 - (encoded.length % 4)) % 4), '=');
        const bytes = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
        const parsed: unknown = JSON.parse(decoder.decode(bytes));

        if (
            typeof parsed === 'object' && parsed !== null
            && typeof (parsed as TokenPayload).playerId === 'string'
            && typeof (parsed as TokenPayload).gameId === 'string'
            && typeof (parsed as TokenPayload).issuedAt === 'number'
        ) {
            return parsed as TokenPayload;
        }

        return null;
    } catch {
        return null;
    }
}

// Constant-time string compare — a plain `===` on a secret-derived value is a
// timing side channel on HMAC verification, even though the practical risk
// for a single-player guessing game is low.
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false;
    }

    let mismatch = 0;

    for (let i = 0; i < a.length; i += 1) {
        mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return mismatch === 0;
}

export async function signPlayerToken(playerId: string, gameId: string, secret: string): Promise<string> {
    const key = await importKey(secret);
    const encodedPayload = encodePayload({ playerId, gameId, issuedAt: Date.now() });
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(encodedPayload));

    return `${encodedPayload}.${toHex(signature)}`;
}

// 'invalid' covers everything that's actually suspicious: missing, malformed,
// doesn't match `gameId`, or doesn't match a signature produced with `secret`
// (which includes tokens for a player id that was never actually drawn).
// 'expired' is its own case — a genuine player who stepped away mid-pick past
// the TTL, not tampering — so callers can respond to it without the
// "you might be cheating" framing 'invalid' deserves.
export type TokenVerification =
    | { valid: true; playerId: string }
    | { valid: false; reason: 'invalid' | 'expired' };

// How long an EXPIRED token can still be re-signed by /api/refresh-tokens —
// long enough to cover a player who closed the choice sheet (or backgrounded
// the app) and came back to the same slot later the same day, short enough
// that a token can't be stockpiled indefinitely.
export const TOKEN_REFRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

type SignatureCheck =
    | { valid: true; payload: TokenPayload }
    | { valid: false };

// Signature + game binding only, no expiry — the shared core of
// verifyPlayerToken and verifyTokenForRefresh below.
async function checkSignature(token: string, gameId: string, secret: string): Promise<SignatureCheck> {
    const separatorIndex = token.lastIndexOf('.');

    if (separatorIndex === -1) {
        return { valid: false };
    }

    const encodedPayload = token.slice(0, separatorIndex);
    const signature = token.slice(separatorIndex + 1);
    const key = await importKey(secret);
    const expectedSignature = toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(encodedPayload)));

    if (!timingSafeEqual(expectedSignature, signature)) {
        return { valid: false };
    }

    const payload = decodePayload(encodedPayload);

    if (!payload || payload.gameId !== gameId) {
        return { valid: false };
    }

    return { valid: true, payload };
}

export async function verifyPlayerToken(token: string, gameId: string, secret: string): Promise<TokenVerification> {
    const check = await checkSignature(token, gameId, secret);

    if (!check.valid) {
        return { valid: false, reason: 'invalid' };
    }

    if (Date.now() - check.payload.issuedAt > TOKEN_TTL_MS) {
        return { valid: false, reason: 'expired' };
    }

    return { valid: true, playerId: check.payload.playerId };
}

// Same checks as verifyPlayerToken, but an expired token still passes as
// long as it's inside TOKEN_REFRESH_WINDOW_MS — used only to re-sign a token
// for the SAME player in the SAME game (/api/refresh-tokens), never to
// reveal anything. Re-signing can't widen what a player learns: it only ever
// covers players this game was already genuinely offered.
export async function verifyTokenForRefresh(token: string, gameId: string, secret: string): Promise<TokenVerification> {
    const check = await checkSignature(token, gameId, secret);

    if (!check.valid) {
        return { valid: false, reason: 'invalid' };
    }

    if (Date.now() - check.payload.issuedAt > TOKEN_REFRESH_WINDOW_MS) {
        return { valid: false, reason: 'expired' };
    }

    return { valid: true, playerId: check.payload.playerId };
}
