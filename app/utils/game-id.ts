// A random per-playthrough id (see GameState.gameId). crypto.randomUUID()
// only exists from Safari/WKWebView 15.4, below the iOS app's deployment
// target, so this falls back to crypto.getRandomValues (iOS 11+) — and, only
// if even that's missing, Math.random. The server just needs something that
// matches /^[\w-]{8,64}$/ (draw.get.ts's GAME_ID_PATTERN); this isn't a
// security boundary, only a token-binding nonce.
export function createGameId(): string {
    const cryptoApi = typeof globalThis.crypto === 'object' ? globalThis.crypto : undefined;

    if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
        return cryptoApi.randomUUID();
    }

    const bytes = new Uint8Array(16);

    if (cryptoApi && typeof cryptoApi.getRandomValues === 'function') {
        cryptoApi.getRandomValues(bytes);
    } else {
        for (let i = 0; i < bytes.length; i += 1) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
    }

    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
