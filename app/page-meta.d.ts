// definePageMeta({ rail: false }) hides the desktop rail on that page
// (read by app/components/shell/AppShell.vue).
declare module '#app' {
    interface PageMeta {
        rail?: boolean;
    }
}

export {};
