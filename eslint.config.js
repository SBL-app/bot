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
        },
    },
    {
        // Fichiers de test : Vitest (ESM).
        files: ['tests/**/*.js'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                ...globals.node,
            },
        },
    },
];
