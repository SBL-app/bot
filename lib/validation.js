'use strict';

/**
 * Helpers de validation / assainissement des entrées utilisateur.
 *
 * OWASP A03 (Injection) / A04 (Insecure Design) : toute donnée fournie par un
 * utilisateur Discord doit être validée avant d'être renvoyée dans un message
 * (injection de markdown / mentions) ou insérée dans une URL d'API.
 */

// Zero-width space, inséré pour neutraliser les mentions sans altérer le rendu.
const ZWSP = '​';

// Caractères de contrôle ASCII (0x00-0x1F et 0x7F). Construit depuis une chaîne
// pour garder une source 100 % ASCII (aucun littéral de contrôle dans le code).
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');

/**
 * Assainit un texte libre : supprime les caractères de contrôle et borne la
 * longueur. Renvoie toujours une chaîne (jamais null/undefined).
 *
 * @param {unknown} input
 * @param {number} [maxLength=256]
 * @returns {string}
 */
function sanitizeText(input, maxLength = 256) {
    if (input === null || input === undefined) return '';
    const stripped = String(input).replace(CONTROL_CHARS, '').trim();
    return stripped.slice(0, maxLength);
}

/**
 * Échappe les caractères spéciaux du markdown Discord et neutralise les
 * mentions (@everyone / @here / <@id>) pour empêcher toute injection lors de
 * l'affichage d'une valeur fournie par l'utilisateur.
 *
 * @param {unknown} input
 * @returns {string}
 */
function escapeDiscordMarkdown(input) {
    return sanitizeText(input)
        .replace(/([\\*_~`|>])/g, '\\$1')
        .replace(/@(everyone|here)/gi, `@${ZWSP}$1`)
        .replace(/<@/g, `<${ZWSP}@`);
}

/**
 * Vérifie qu'une valeur représente un identifiant entier strictement positif.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function isValidId(value) {
    if (typeof value === 'number') return Number.isInteger(value) && value > 0;
    if (typeof value === 'string' && /^\d+$/.test(value)) return parseInt(value, 10) > 0;
    return false;
}

/**
 * Construit une chaîne de requête en encodant correctement clés et valeurs
 * (prévient l'injection de paramètres). Ignore les valeurs null/undefined/''.
 *
 * @param {Record<string, unknown>} params
 * @returns {string} ex: '?week=3&season_id=1' ou '' si vide
 */
function buildQuery(params = {}) {
    const parts = Object.entries(params)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    return parts.length ? `?${parts.join('&')}` : '';
}

module.exports = {
    sanitizeText,
    escapeDiscordMarkdown,
    isValidId,
    buildQuery,
};
