const { API_URL } = require('../apiConfig');

const BOT_SECRET = process.env.API_SECRET;

// Cache des tokens JWT par discordId
// { discordId: { token, expiresAt } }
const tokenCache = new Map();

// Marge de sécurité : renouveler 5 minutes avant expiration
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

/**
 * Décode le payload d'un JWT pour en extraire l'expiration
 */
function getTokenExpiry(token) {
    try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
        return payload.exp ? payload.exp * 1000 : 0;
    } catch {
        return 0;
    }
}

/**
 * Obtient un JWT valide pour un utilisateur Discord.
 * Utilise le cache si le token est encore valide, sinon en demande un nouveau.
 */
async function getToken(discordId) {
    const cached = tokenCache.get(discordId);
    if (cached && cached.expiresAt > Date.now() + EXPIRY_MARGIN_MS) {
        return cached.token;
    }

    if (!BOT_SECRET) {
        throw new Error('API_SECRET non configuré — impossible d\'authentifier le bot');
    }

    const response = await fetch(`${API_URL}/auth/discord/bot`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Bot-Secret': BOT_SECRET,
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

        // Ne pas cacher un token invalide
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

/**
 * Effectue une requête API authentifiée pour un utilisateur Discord.
 *
 * @param {string} endpoint - L'endpoint API (ex: '/teams/create-with-captain')
 * @param {object} options - Options fetch (method, body, headers...)
 * @param {string} discordId - L'ID Discord de l'utilisateur
 * @returns {Promise<{data: any, error: string|null, authError: boolean}>}
 */
async function authenticatedFetch(endpoint, options = {}, discordId) {
    try {
        const token = await getToken(discordId);

        const url = `${API_URL}${endpoint}`;
        const response = await fetch(url, {
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
        });

        // Si le token a expiré malgré le cache, on retry une fois
        if (response.status === 401) {
            tokenCache.delete(discordId);

            const newToken = await getToken(discordId);
            const retryResponse = await fetch(url, {
                method: options.method || 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'SBL-Discord-Bot',
                    'Authorization': `Bearer ${newToken}`,
                    ...options.headers,
                },
                body: options.body,
                signal: AbortSignal.timeout(options.timeout || 15000),
            });

            return await parseResponse(retryResponse);
        }

        return await parseResponse(response);

    } catch (error) {
        if (error.name === 'TimeoutError') {
            return { data: null, error: 'Timeout - L\'API ne répond pas', authError: false };
        }
        // Les erreurs d'auth sont identifiées par le message
        const isAuthError = error.message.includes('authentification') || error.message.includes('API_SECRET');
        return { data: null, error: error.message, authError: isAuthError };
    }
}

/**
 * Parse la réponse API en format standardisé
 */
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

module.exports = { authenticatedFetch };
