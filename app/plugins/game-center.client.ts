import { App } from '@capacitor/app';
import { authenticate, isAuthenticated, isAvailable, submitStatsToGameCenter, watchAuth } from '../utils/game-center';
import type { GameCenterStats } from '../utils/game-center';
import { isNativeApp } from '../utils/platform';

// iOS app only: signs in to Game Center quietly once the first screen is up
// (GameKit shows its own sign-in banner or sheet, never one of ours), again on
// every resume while still signed out, and follows sign-ins made later from
// iOS Settings. Each successful sign-in catches the leaderboards up with the
// current stats. Same timing as Footballdle's native-app.client.ts.
// On the website this returns straight away.
const LAUNCH_AUTH_DELAY_MS = 800;

export default defineNuxtPlugin((nuxtApp) => {
    if (!isNativeApp() || !isAvailable()) {
        return;
    }

    const { stats } = useStats();
    // useStats().stats is the full GameStats; the leaderboards read just
    // these three fields (two of them are newer, optional fields).
    const catchUp = () => {
        submitStatsToGameCenter(stats.value as GameCenterStats).catch(() => {});
    };

    watchAuth((authenticated) => {
        if (authenticated) {
            catchUp();
        }
    });

    nuxtApp.hook('app:mounted', () => {
        setTimeout(() => {
            authenticate('launch')
                .then((signedIn) => {
                    if (signedIn) {
                        catchUp();
                    }
                })
                .catch(() => {});
        }, LAUNCH_AUTH_DELAY_MS);
    });

    App.addListener('resume', () => {
        if (isAuthenticated.value) {
            return;
        }
        authenticate('resume')
            .then((signedIn) => {
                if (signedIn) {
                    catchUp();
                }
            })
            .catch(() => {});
    }).catch(() => {});
});
