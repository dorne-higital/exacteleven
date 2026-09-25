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

// Returns the player id the token was issued for, or null if the token is
// missing, malformed, expired, doesn't match `gameId`, or doesn't match a
// signature produced with `secret` (which includes tokens for a player id
// that was never actually drawn).
export async function verifyPlayerToken(token: string, gameId: string, secret: string): Promise<string | null> {
    const separatorIndex = token.lastIndexOf('.');

    if (separatorIndex === -1) {
        return null;
    }

    const encodedPayload = token.slice(0, separatorIndex);
    const signature = token.slice(separatorIndex + 1);
    const key = await importKey(secret);
    const expectedSignature = toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(encodedPayload)));

    if (!timingSafeEqual(expectedSignature, signature)) {
        return null;
    }

    const payload = decodePayload(encodedPayload);

    if (!payload || payload.gameId !== gameId || Date.now() - payload.issuedAt > TOKEN_TTL_MS) {
        return null;
    }

    return payload.playerId;
}
