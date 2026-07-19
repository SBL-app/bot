'use strict';

const path = require('path');

/**
 * Charge la configuration du bot.
 *
 * Ordre de priorité (12-factor / OWASP A05 — pas de secret en dur) :
 *   1. Variables d'environnement (utilisées en production / Docker)
 *   2. Fichier config.json local (développement uniquement, non commité)
 *
 * Aucune valeur secrète n'est journalisée.
 */
function loadFileConfig() {
    try {
        // config.json est ignoré par git et absent en production.
        return require(path.join(__dirname, '..', 'config.json'));
    } catch {
        return {};
    }
}

const file = loadFileConfig();

const config = {
    token: process.env.DISCORD_TOKEN || file.token,
    applicationId: process.env.DISCORD_CLIENT_ID || file.applicationId,
    apiUrl: process.env.API_URL || file.apiUrl,
    apiSecret: process.env.API_SECRET || file.apiSecret,
};

/**
 * Vérifie que les clés obligatoires sont présentes.
 * @param {string[]} required - clés obligatoires
 * @throws {Error} si une clé est manquante
 */
function assertConfig(required = ['token', 'applicationId']) {
    const missing = required.filter((key) => !config[key]);
    if (missing.length > 0) {
        throw new Error(
            `Configuration manquante : ${missing.join(', ')}. ` +
                'Définissez les variables d\'environnement correspondantes ' +
                '(DISCORD_TOKEN, DISCORD_CLIENT_ID, API_URL) ou un config.json local.',
        );
    }
}

module.exports = config;
module.exports.assertConfig = assertConfig;
