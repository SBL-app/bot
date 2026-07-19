'use strict';

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    {
        ignores: ['node_modules/**', 'coverage/**'],
    },
    js.configs.recommended,
    {
        // Code source du bot : CommonJS, environnement Node.
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
            },
        },
        rules: {
            // Style/qualité : signalés en warning pour ne pas bloquer la CI sur
            // la dette du code existant, tout en restant visibles.
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-console': 'off',
            eqeqeq: ['warn', 'smart'],
            'prefer-const': 'warn',
            // Erreur : le `var` est proscrit dans le nouveau code.
            'no-var': 'error',
            // Usage intentionnel : suppression des caractères de contrôle dans
            // l'assainissement des entrées (lib/validation.js).
            'no-control-regex': 'off',
        },
    },
    {
        // Fichiers de test et config Vitest : ESM.
        files: ['tests/**/*.js', 'vitest.config.js'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
        },
    },
];
