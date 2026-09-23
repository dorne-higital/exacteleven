// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs';

export default withNuxt(
    {
        // Route pages are addressed by their file path, not a multi-word
        // component name, so the single-word rule doesn't apply to them.
        files: ['app/pages/**/*.vue'],
        rules: {
            'vue/multi-word-component-names': 'off',
        },
    },
    {
        // "Pitch" is the football pitch component name specified by the
        // project brief; it is a domain term, not a generic single word.
        files: ['app/components/Pitch.vue'],
        rules: {
            'vue/multi-word-component-names': 'off',
        },
    },
);
