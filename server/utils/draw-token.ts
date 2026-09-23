// Stateless anti-peek proof for the draw -> reveal flow (see the build
// brief's "Anti-peeking" note). A draw token is an HMAC over the player id,
// so /api/reveal can verify — cryptographically, without trusting the
// client and without any server-side session/game-token store — that a
// given player was genuinely offered by /api/draw earlier in this game.
// Uses the Web Crypto API rather than Node's `crypto` module so it also runs
// on the Cloudflare Workers runtime this project targets in production.
const encoder = new TextEncoder();

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

export async function signPlayerToken(playerId: string, secret: string): Promise<string> {
    const key = await importKey(secret);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(playerId));

    return `${playerId}.${toHex(signature)}`;
}

// Returns the player id the token was issued for, or null if the token is
// missing, malformed, or doesn't match a signature produced with `secret`
// (which includes tokens for a player id that was never actually drawn).
export async function verifyPlayerToken(token: string, secret: string): Promise<string | null> {
    const separatorIndex = token.lastIndexOf('.');

    if (separatorIndex === -1) {
        return null;
    }

    const playerId = token.slice(0, separatorIndex);
    const expected = await signPlayerToken(playerId, secret);

    return timingSafeEqual(expected, token) ? playerId : null;
}
