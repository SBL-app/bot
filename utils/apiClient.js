const config = require('../config.json');

/**
 * Client API centralisé pour gérer les requêtes vers l'API SBL
 */
class ApiClient {
    constructor() {
        this.baseUrl = config.apiUrl.startsWith('http') ? config.apiUrl : `http://${config.apiUrl}`;
        this.timeout = 15000; // 15 secondes
        this.userAgent = 'SBL-Discord-Bot';
    }

    /**
     * Effectue une requête GET vers l'API
     * @param {string} endpoint - L'endpoint à appeler (sans /api/)
     * @param {Object} params - Paramètres de requête
     * @returns {Promise<Object>} - Réponse de l'API
     */
    async get(endpoint, params = {}) {
        const url = new URL(`${this.baseUrl}/${endpoint}`);
        
        // Ajouter les paramètres de requête
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined) {
                url.searchParams.append(key, params[key]);
            }
        });

        const startTime = Date.now();

        try {
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'User-Agent': this.userAgent,
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(this.timeout)
            });

            const responseTime = Date.now() - startTime;

            if (!response.ok) {
                throw new ApiError(response.status, response.statusText, url.toString());
            }

            const data = await response.json();
            return {
                data,
                responseTime,
                status: response.status
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            if (error.name === 'TimeoutError') {
                throw new ApiError(408, 'Request Timeout', url.toString());
            }
            
            if (error instanceof ApiError) {
                throw error;
            }

            throw new ApiError(0, error.message, url.toString());
        }
    }

    /**
     * Récupère toutes les équipes
     */
    async getTeams() {
        return this.get('teams');
    }

    /**
     * Récupère une équipe spécifique par ID
     */
    async getTeam(id) {
        return this.get('teams', { id });
    }

    /**
     * Récupère les détails complets d'une équipe
     */
    async getTeamDetails(teamId) {
        return this.get('teams/details', { team_id: teamId });
    }

    /**
     * Récupère les joueurs d'une équipe
     */
    async getPlayers(teamId = null) {
        const params = teamId ? { team: teamId } : {};
        return this.get('players', params);
    }

    /**
     * Récupère toutes les saisons
     */
    async getSeasons() {
        return this.get('season');
    }

    /**
     * Récupère une saison spécifique par ID
     */
    async getSeason(id) {
        return this.get('season', { id });
    }

    /**
     * Récupère les équipes d'une saison
     */
    async getSeasonTeams(seasonId) {
        return this.get('season/teams', { id: seasonId });
    }

    /**
     * Récupère le pourcentage de progression d'une saison
     */
    async getSeasonProgress(seasonId, decimal = 2) {
        return this.get('season/pourcent', { id: seasonId, decimal });
    }

    /**
     * Récupère toutes les divisions
     */
    async getDivisions() {
        return this.get('division');
    }

    /**
     * Récupère une division spécifique par ID
     */
    async getDivision(id) {
        return this.get('division', { id });
    }

    /**
     * Récupère les divisions d'une saison
     */
    async getSeasonDivisions(seasonId) {
        return this.get('division/season', { id: seasonId });
    }

    /**
     * Récupère les équipes d'une division avec classement
     */
    async getDivisionTeams(divisionId) {
        return this.get('division/teams', { id: divisionId });
    }

    /**
     * Récupère les matchs d'une division
     */
    async getDivisionGames(divisionId) {
        return this.get('division/games', { id: divisionId });
    }

    /**
     * Récupère les détails complets d'une division
     */
    async getDivisionDetails(divisionId) {
        return this.get('division/details', { division_id: divisionId });
    }

    /**
     * Récupère les matchs
     */
    async getGames(params = {}) {
        return this.get('games', params);
    }

    /**
     * Récupère les statistiques d'équipes
     */
    async getTeamStats(params = {}) {
        return this.get('teamStats', params);
    }

    /**
     * Récupère les statuts de match
     */
    async getGameStatus(id = null) {
        const params = id ? { id } : {};
        return this.get('gameStatus', params);
    }

    /**
     * Teste la connectivité de l'API
     */
    async testConnection() {
        const startTime = Date.now();
        
        try {
            const response = await fetch(this.baseUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': this.userAgent
                },
                signal: AbortSignal.timeout(10000)
            });

            const responseTime = Date.now() - startTime;

            let apiInfo = null;
            if (response.ok) {
                try {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        apiInfo = await response.json();
                    }
                } catch (e) {
                    // Ignore les erreurs de parsing JSON
                }
            }

            return {
                status: response.status,
                statusText: response.ok ? 'En ligne' : 'Hors ligne',
                responseTime,
                isOnline: response.ok,
                apiInfo
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            return {
                status: 0,
                statusText: 'Hors ligne',
                responseTime,
                isOnline: false,
                error: error.message
            };
        }
    }
}

/**
 * Classe d'erreur personnalisée pour l'API
 */
class ApiError extends Error {
    constructor(status, message, url) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.url = url;
    }

    isNotFound() {
        return this.status === 404;
    }

    isTimeout() {
        return this.status === 408;
    }

    isServerError() {
        return this.status >= 500;
    }
}

module.exports = { ApiClient, ApiError };
