import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { ref } from 'vue';
import { trackEvent } from './analytics';
import { LEADERBOARD_IDS } from './appStore';
import { isNativeApp } from './platform';

// Thin bridge to the iOS app's own Game Center plugin
// (ios/App/App/GameCenterPlugin.swift, registered in MainViewController.swift).
// Ported from Footballdle's useGameCenter.ts. On the website (and anywhere
// that isn't the native iOS shell) every function here is a silent no-op and
// the plugin is never even registered.
//
// Capacitor plugin proxies look like thenables, so the proxy is only ever
// used for a method call — never returned from an async function or awaited
// as a value (r1 plan 6.10).
interface GameCenterPlugin {
    authenticate(): Promise<{ authenticated: boolean; error?: string }>;
    submitScore(options: { leaderboardId: string; score: number }): Promise<void>;
    reportAchievements(options: { achievements: { id: string; percent: number }[] }): Promise<void>;
    showLeaderboards(options?: { leaderboardId?: string }): Promise<void>;
    showAchievements(): Promise<void>;
    addListener(event: 'authChanged', handler: (data: { authenticated: boolean }) => void): Promise<PluginListenerHandle>;
}

// 'launch' / 'resume' are the quiet sign-ins from plugins/game-center.client.ts,
// 'tap' is a player opening the leaderboards.
export type GameCenterAuthSource = 'launch' | 'resume' | 'tap';

// The best value already sent to each leaderboard, so a finished game only
// submits the boards whose number actually went up.
export const GAME_CENTER_SUBMITTED_KEY = 'exact-xi-gc-submitted';

const TAP_AUTH_TIMEOUT_MS = 10000;

let plugin: GameCenterPlugin | null = null;

function gameCenter(): GameCenterPlugin | null {
    if (!isAvailable()) {
        return null;
    }
    plugin ??= registerPlugin<GameCenterPlugin>('GameCenter');
    return plugin;
}

// Shared across callers: one Game Center session per app launch.
export const isAuthenticated = ref(false);
export const lastError = ref('');
let watchingAuth = false;

export function isAvailable(): boolean {
    if (!isNativeApp()) {
        return false;
    }
    try {
        return Capacitor.getPlatform() === 'ios';
    } catch {
        return false;
    }
}

// GameKit can sit on a sign-in it never shows, so a tap never waits forever
// (pass a timeout); the quiet launch sign-in just waits.
export async function authenticate(source: GameCenterAuthSource = 'tap', timeoutMs = 0): Promise<boolean> {
    const gc = gameCenter();
    if (!gc) {
        return false;
    }

    let result: 'signed_in' | 'failed' | 'timeout' = 'failed';
    try {
        const signIn = gc.authenticate();
        const response = timeoutMs
            ? await Promise.race([
                signIn,
                new Promise<{ authenticated: boolean; error?: string; timedOut: true }>((resolve) => {
                    setTimeout(() => resolve({ authenticated: false, error: 'Game Center didn\'t respond', timedOut: true }), timeoutMs);
                }),
            ])
            : await signIn;
        isAuthenticated.value = response.authenticated === true;
        lastError.value = response.error ?? '';
        result = isAuthenticated.value ? 'signed_in' : ('timedOut' in response ? 'timeout' : 'failed');
    } catch (error) {
        isAuthenticated.value = false;
        lastError.value = error instanceof Error ? error.message : String(error);
    }

    // A signed-out player would otherwise log a failure on every resume.
    if (source !== 'resume' || result === 'signed_in') {
        trackEvent('game_center_auth', { result, source });
    }
    return isAuthenticated.value;
}

// Follows sign-ins that happen later in the session (from iOS Settings or the
// Game Center sheet), so scores start going up straight away.
export function watchAuth(onChange?: (authenticated: boolean) => void): void {
    const gc = gameCenter();
    if (!gc || watchingAuth) {
        return;
    }
    watchingAuth = true;
    gc.addListener('authChanged', ({ authenticated }) => {
        isAuthenticated.value = authenticated;
        if (authenticated) {
            lastError.value = '';
        }
        onChange?.(authenticated);
    }).catch(() => {});
}

// Game Center keeps each player's best, so resubmitting is harmless. Resolves
// true once the score is accepted.
export async function submitScore(leaderboardId: string, value: number): Promise<boolean> {
    const gc = gameCenter();
    if (!gc || !isAuthenticated.value || !Number.isInteger(value) || value <= 0) {
        return false;
    }
    try {
        await gc.submitScore({ leaderboardId, score: value });
        return true;
    } catch {
        return false;
    }
}

// Opened from a tap, so a failure is shown rather than swallowed. Pass a
// leaderboard id to open that board, or nothing for the full list.
export async function showLeaderboards(leaderboardId?: string): Promise<boolean> {
    const gc = gameCenter();
    if (!gc) {
        return false;
    }

    trackEvent('view_leaderboard', { leaderboard_id: leaderboardId ?? 'all' });

    if (!isAuthenticated.value && !(await authenticate('tap', TAP_AUTH_TIMEOUT_MS))) {
        window.alert(
            `Couldn't sign in to Game Center${lastError.value ? `: ${lastError.value}` : ''}.\n\n`
            + 'Check you are signed in under Settings → Game Center, then try again.',
        );
        return false;
    }
    try {
        await gc.showLeaderboards(leaderboardId ? { leaderboardId } : {});
        return true;
    } catch (error) {
        window.alert(`Couldn't open Game Center: ${error instanceof Error ? error.message : String(error)}`);
        return false;
    }
}

// --- Stats → leaderboards ----------------------------------------------------

// The stats fields the leaderboards read. unassistedWins and bestExactRun are
// new GameStats fields (another part of the app plan), so all three are
// optional here and a missing one is simply not submitted.
// - bestDailyStreak: never boosted (boosts don't work in the Daily).
// - unassistedWins: exact Classic wins with no banked boost or Pro extra.
// - bestExactRun: best run of consecutive exact Classic wins.
export interface GameCenterStats {
    bestDailyStreak?: number;
    unassistedWins?: number;
    bestExactRun?: number;
}

export type SubmittedScores = Record<string, number>;

export function leaderboardScores(stats: GameCenterStats): SubmittedScores {
    return {
        [LEADERBOARD_IDS.dailyBestStreak]: stats.bestDailyStreak ?? 0,
        [LEADERBOARD_IDS.classicExactWins]: stats.unassistedWins ?? 0,
        [LEADERBOARD_IDS.classicBestRun]: stats.bestExactRun ?? 0,
    };
}

// Pure: which boards have a positive whole-number score above what was last
// sent. Game Center never lowers a score, so a value that dropped (a reset)
// is just skipped.
export function scoresToSubmit(stats: GameCenterStats, submitted: SubmittedScores): SubmittedScores {
    const out: SubmittedScores = {};
    for (const [id, value] of Object.entries(leaderboardScores(stats))) {
        if (Number.isInteger(value) && value > 0 && value > (submitted[id] ?? 0)) {
            out[id] = value;
        }
    }
    return out;
}

export function readSubmittedScores(): SubmittedScores {
    try {
        const parsed: unknown = JSON.parse(window.localStorage.getItem(GAME_CENTER_SUBMITTED_KEY) ?? '{}');
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            return {};
        }
        return Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>)
                .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isInteger(entry[1]) && entry[1] >= 0),
        );
    } catch {
        return {};
    }
}

function writeSubmittedScores(submitted: SubmittedScores): void {
    try {
        window.localStorage.setItem(GAME_CENTER_SUBMITTED_KEY, JSON.stringify(submitted));
    } catch {
        // Storage blocked: the next game just resubmits, which is harmless.
    }
}

// Call after every finished game (and after a sign-in). Submits only the
// boards whose value went up since the last accepted submission; does nothing
// on the web or when not signed in, so those values go up at the next chance.
export async function submitStatsToGameCenter(stats: GameCenterStats): Promise<void> {
    if (!isAvailable() || !isAuthenticated.value) {
        return;
    }
    const pending = scoresToSubmit(stats, readSubmittedScores());
    for (const [id, value] of Object.entries(pending)) {
        if (await submitScore(id, value)) {
            // Re-read so two overlapping calls can't roll each other back.
            const submitted = readSubmittedScores();
            submitted[id] = Math.max(submitted[id] ?? 0, value);
            writeSubmittedScores(submitted);
        }
    }
}
