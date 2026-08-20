'use strict';

// Appels API authentifiés pour le compte d'un utilisateur Discord.
//
// Le bot échange son secret partagé contre un JWT propre à l'utilisateur via
// POST /auth/discord/bot, puis présente ce jeton sur les endpoints protégés.
// Les jetons sont mis en cache par discordId et renouvelés avant expiration.
//
// Version CommonJS : `main` n'est pas en ESM. La branche `dev` porte la même
// logique en modules ES ; les deux devront être réconciliées quand la
// migration ESM atterrira. Voir la PR qui a introduit ce fichier.

const config = require('../lib/config');

const API_URL = config.apiUrl;

// Cache des tokens JWT par discordId
// { discordId: { token, expiresAt } }
const tokenCache = new Map();

// Marge de sécurité : renouveler 5 minutes avant expiration
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

function getTokenExpiry(token) {
    try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
        return payload.exp ? payload.exp * 1000 : 0;
    } catch {
        return 0;
    }
}

async function getToken(discordId) {
    const cached = tokenCache.get(discordId);
    if (cached && cached.expiresAt > Date.now() + EXPIRY_MARGIN_MS) {
        return cached.token;
    }

    const botSecret = config.apiSecret;
    if (!botSecret) {
        throw new Error('API_SECRET non configuré — impossible d\'authentifier le bot');
    }

    const response = await fetch(`${API_URL}/auth/discord/bot`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Bot-Secret': botSecret,
            'User-Agent': 'SBL-Discord-Bot',
        },
        body: JSON.stringify({ discord_id: discordId }),
        signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
        const contentType = response.headers.get('content-type');
        let errorMsg = `Erreur d'authentification bot (${response.status})`;

        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            errorMsg = data.detail || data.error || errorMsg;
        }

        tokenCache.delete(discordId);
        throw new Error(errorMsg);
    }

    const data = await response.json();
    const token = data.token;

    tokenCache.set(discordId, {
        token,
        expiresAt: getTokenExpiry(token),
    });

    return token;
}

async function parseResponse(response) {
    const contentType = response.headers.get('content-type');

    if (!contentType || !contentType.includes('application/json')) {
        return {
            data: null,
            error: 'L\'API a renvoyé une réponse invalide (non-JSON)',
            authError: false,
        };
    }

    const data = await response.json();

    if (!response.ok) {
        return {
            data: null,
            error: data.detail || data.error || `Erreur API: ${response.status}`,
            authError: response.status === 401 || response.status === 403,
        };
    }

    return { data, error: null, authError: false };
}

function buildRequest(options, token) {
    return {
        method: options.method || 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'SBL-Discord-Bot',
            'Authorization': `Bearer ${token}`,
            ...options.headers,
        },
        body: options.body,
        signal: AbortSignal.timeout(options.timeout || 15000),
    };
}

/**
 * Appelle l'API au nom d'un utilisateur Discord, jeton JWT compris.
 *
 * @param {string} endpoint - Endpoint à appeler (ex. '/teams/1/members')
 * @param {object} options - Options fetch additionnelles
 * @param {string} discordId - Identifiant Discord de l'utilisateur
 * @returns {Promise<{data: any, error: string|null, authError: boolean}>}
 */
async function authenticatedFetch(endpoint, options = {}, discordId) {
    try {
        const token = await getToken(discordId);
        const url = `${API_URL}${endpoint}`;

        const response = await fetch(url, buildRequest(options, token));

        // Si le token a expiré malgré le cache, on retry une fois
        if (response.status === 401) {
            tokenCache.delete(discordId);

            const newToken = await getToken(discordId);
            const retryResponse = await fetch(url, buildRequest(options, newToken));

            return await parseResponse(retryResponse);
        }

        return await parseResponse(response);

    } catch (error) {
        if (error.name === 'TimeoutError') {
            return { data: null, error: 'Timeout - L\'API ne répond pas', authError: false };
        }
        const isAuthError = error.message.includes('authentification') || error.message.includes('API_SECRET');
        return { data: null, error: error.message, authError: isAuthError };
    }
}

module.exports = { authenticatedFetch };
