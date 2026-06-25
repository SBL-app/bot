// API Configuration
// Uses environment variable in production (Docker), falls back to config.json for local development
const config = require('./config.json');

const API_URL = process.env.API_URL || config.apiUrl;

/**
 * Effectue une requête API avec gestion robuste des erreurs
 * @param {string} endpoint - L'endpoint à appeler (ex: '/seasons')
 * @param {object} options - Options fetch additionnelles
 * @returns {Promise<{data: any, error: string|null, status: number}>}
 */
async function fetchAPI(endpoint, options = {}) {
    const url = `${API_URL}${endpoint}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'SBL-Discord-Bot',
                'Accept': 'application/json',
                ...options.headers
            },
            signal: AbortSignal.timeout(options.timeout || 15000),
            ...options
        });

        const contentType = response.headers.get('content-type');

        // Vérifier si la réponse est du JSON
        if (!contentType || !contentType.includes('application/json')) {
            // Essayer de lire le texte pour le debug
            const text = await response.text();
            console.error(`[API] Réponse non-JSON reçue de ${url}:`, text.substring(0, 200));

            return {
                data: null,
                error: 'L\'API a renvoyé une réponse invalide (non-JSON)',
                status: response.status
            };
        }

        const data = await response.json();

        if (!response.ok) {
            return {
                data: null,
                error: data.error || `Erreur API: ${response.status}`,
                status: response.status
            };
        }

        return { data, error: null, status: response.status };

    } catch (error) {
        let errorMessage = 'Erreur de connexion à l\'API';

        if (error.name === 'TimeoutError') {
            errorMessage = 'Timeout - L\'API ne répond pas';
        } else if (error.name === 'SyntaxError') {
            errorMessage = 'Réponse API invalide (JSON malformé)';
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = 'Serveur API introuvable';
        } else if (error.code === 'ECONNREFUSED') {
            errorMessage = 'Connexion refusée par l\'API';
        }

        console.error(`[API] Erreur lors de l'appel à ${url}:`, error.message);

        return { data: null, error: errorMessage, status: 0 };
    }
}

module.exports = { API_URL, fetchAPI };
