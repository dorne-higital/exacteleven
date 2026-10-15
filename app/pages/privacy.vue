<script setup lang="ts">
import { trackEvent } from '../utils/analytics';

// Needed for the App Store listing (and good practice for the website). Plain
// on purpose — the copy only states what the code actually does today, so it
// must be revisited whenever storage, analytics or a third party changes
// (e.g. Game Center, in-app purchases or iCloud backup in the app).
// TODO(owner): confirm the contact address before the App Store submission.
const CONTACT_EMAIL = 'hello@exacteleven.co.uk';
const LAST_UPDATED = '13 October 2026';

// Desktop "On this page" list, built from the section h2 ids below.
const TOC = [
    { id: 'privacy-summary', label: 'The short version' },
    { id: 'privacy-device', label: 'Stored on your device' },
    { id: 'privacy-server', label: 'When you play' },
    { id: 'privacy-analytics', label: 'Analytics' },
    { id: 'privacy-third-parties', label: 'Other services' },
    { id: 'privacy-contact', label: 'Contact' },
];

function handleTocClick(section: string): void {
    trackEvent('privacy_toc_click', { section });
}

function handleContactClick(): void {
    trackEvent('contact_click', { source: 'privacy' });
}

usePageSeoMeta({
    title: 'Privacy — Exact XI',
    description: 'What Exact XI stores, what it measures, and what it never collects — no accounts, no personal details.',
});
</script>

<template>
    <main class="privacy">
        <AppHeader>
            <NuxtLink class="app-header-back privacy__back" to="/">
                <AppIcon name="back" />
                Home
            </NuxtLink>
        </AppHeader>

        <div class="privacy__inner">
            <div class="privacy__body">
            <h1>Privacy</h1>

            <p class="privacy__updated">Last updated {{ LAST_UPDATED }}</p>

            <section aria-labelledby="privacy-summary">
                <h2 id="privacy-summary">The short version</h2>
                <p>
                    Exact XI has no accounts, no sign-up and no log-in. It never asks for your name, email address or
                    any other personal details, and nothing you do in the game is sold or shared for advertising.
                </p>
            </section>

            <section aria-labelledby="privacy-device">
                <h2 id="privacy-device">Stored on your device</h2>
                <p>To remember your progress, the game keeps a few small records in your browser (or in the app) on this device only:</p>
                <ul>
                    <li>your stats — games played, wins, results, your Daily Challenge streak and recent Daily results;</li>
                    <li>which achievements you've already been shown;</li>
                    <li>the game you're in the middle of, so a refresh or a closed app doesn't lose it (cleared after a day of no play);</li>
                    <li>a random ID for this device, used only for the Daily (see below).</li>
                </ul>
                <p>
                    Apart from that Daily ID and score, none of this is sent to us. Clearing your browser's site data (or deleting the app) removes it, and it
                    doesn't move between devices.
                </p>
            </section>

            <section aria-labelledby="privacy-server">
                <h2 id="privacy-server">When you play</h2>
                <p>
                    Each pick asks our server for players and reveals their stats. Those requests carry only game details
                    (positions, the players offered, your running total) — nothing that identifies you. Like any website,
                    our host (Netlify) briefly processes your IP address to deliver the site and to stop abuse, such as
                    limiting how many requests one address can make in a few minutes.
                </p>
                <p>
                    The Daily sends an anonymous random ID and your score so we can show how you compare. No name, no account.
                </p>
            </section>

            <section aria-labelledby="privacy-analytics">
                <h2 id="privacy-analytics">Analytics</h2>
                <p>
                    On the website we use Google Analytics 4 (loaded through Google Tag Manager) to count page views and
                    game events — for example that a game started, a player was picked or a Daily was finished — so we
                    can see what's working. Google sets its own cookies to do this. We don't send it your name, email or
                    anything you type.
                </p>
                <p>The iOS app does not include Google Analytics or Google Tag Manager.</p>
            </section>

            <section aria-labelledby="privacy-third-parties">
                <h2 id="privacy-third-parties">Other services</h2>
                <p>
                    The website shows a Buy Me a Coffee button. It loads from Buy Me a Coffee's own servers, and if you
                    choose to support us, that happens on their site under their privacy policy.
                </p>
            </section>

            <section aria-labelledby="privacy-contact">
                <h2 id="privacy-contact">Contact</h2>
                <p>
                    Questions about any of this? Email
                    <a :href="`mailto:${CONTACT_EMAIL}`" @click="handleContactClick">{{ CONTACT_EMAIL }}</a>.
                </p>
            </section>
            </div>

            <nav aria-labelledby="privacy-toc-title" class="privacy__toc">
                <p id="privacy-toc-title" class="privacy__toc-title">On this page</p>
                <ol class="privacy__toc-list">
                    <li v-for="item in TOC" :key="item.id">
                        <a class="privacy__toc-link" :href="`#${item.id}`" @click="handleTocClick(item.id)">{{ item.label }}</a>
                    </li>
                </ol>
            </nav>
        </div>
    </main>
</template>

<style lang="scss" scoped>
// Same page shell as how-to-play.vue: a plain reading page, each section on
// its own Bib & Board surface card.
.privacy {
    box-sizing: border-box;
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
    gap: 1.25rem;
    padding: 1rem 1rem 5.5rem;
}

.privacy__inner {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin: 0 auto;
    max-width: var(--page-max);
    width: 100%;
}

// Phone + tablet: the body wrapper vanishes so the page is today's column,
// and the "On this page" list is desktop only.
.privacy__body {
    display: contents;
}

.privacy__toc {
    display: none;
}

@media (width >= 1024px) {
    .privacy {
        padding: 2rem 2rem 5.5rem;
    }

    .privacy__inner {
        align-items: start;
        column-gap: 3rem;
        display: grid;
        grid-template-columns: minmax(0, 42rem) 14rem;
        justify-content: center;
    }

    .privacy__body {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        min-width: 0;
    }

    .privacy__toc {
        display: flex;
        flex-direction: column;
        gap: 0.4rem;
        position: sticky;
        top: 2rem;
    }

    // Land headings below the top edge when a TOC link scrolls to them.
    h2 {
        scroll-margin-top: 2rem;
    }
}

.privacy__toc-title {
    color: var(--color-muted);
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    margin: 0;
    text-transform: uppercase;
}

.privacy__toc-list {
    border-left: 1px solid var(--color-line);
    list-style: none;
    margin: 0;
    padding: 0;
}

.privacy__toc-link {
    align-items: center;
    border-radius: var(--radius-sm);
    color: var(--color-muted);
    display: flex;
    font-size: 0.85rem;
    font-weight: 600;
    min-height: var(--tap-min);
    padding: 0 0.75rem;
    text-decoration: none;
}

@media (hover: hover) and (pointer: fine) {
    .privacy__toc-link:hover {
        color: var(--color-foreground);
    }
}

// The back pill's look comes from AppHeader (.app-header-back).
.privacy__back {
    margin-right: auto;
}

.privacy__updated {
    color: var(--color-muted);
    font-family: var(--font-mono);
    font-size: 0.78rem;
    margin: 0 0 0.25rem;
}

section {
    background-color: var(--color-surface);
    border: 1px solid var(--color-line);
    border-radius: var(--radius-card);
    box-shadow: var(--shadow-sm);
    padding: 1rem 1.1rem;
}

h1,
h2 {
    margin: 0;
}

h2 {
    font-size: 1.4rem;
    margin-bottom: 0.5rem;
}

p,
ul {
    line-height: 1.55;
    margin: 0 0 0.6rem;
}

ul {
    padding-left: 1.2rem;
}

li::marker {
    color: var(--color-primary);
}

section > :last-child {
    margin-bottom: 0;
}

a {
    color: var(--color-primary);
    font-weight: 600;
    overflow-wrap: anywhere;
}
</style>
