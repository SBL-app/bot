/**
 * Sonde push (heartbeat) vers Uptime Kuma.
 *
 * Pourquoi une sonde push et non une sonde HTTP classique ?
 * Le bot Discord n'expose aucun port (choix de sécurité : il vit sur un réseau
 * isolé et n'accepte aucune connexion entrante). Il est donc impossible de le
 * surveiller « de l'extérieur ». C'est le bot qui signale périodiquement sa
 * vitalité ; si Uptime Kuma ne reçoit rien pendant le délai configuré, il
 * déclenche l'alerte.
 *
 * Ce que la sonde détecte réellement :
 * Un simple « le process tourne » serait insuffisant. Un bot Discord peut être
 * un « zombie » : le process Node est vivant, le conteneur est up, mais la
 * connexion websocket vers Discord est rompue — le bot ne répond plus à aucune
 * commande alors que tous les indicateurs système sont au vert. Le heartbeat
 * n'est donc émis que si le client est réellement connecté (client.isReady())
 * et il transmet la latence websocket pour suivre la qualité de la connexion.
 */

const DEFAULT_INTERVAL_SECONDS = 60;

/**
 * Latence websocket (ms) au-delà de laquelle la connexion est jugée dégradée.
 * Discord considère qu'au-delà de ce seuil l'expérience utilisateur se
 * détériore (temps de réponse des commandes perceptible).
 */
const DEGRADED_PING_MS = 500;

/**
 * Construit l'URL de push Uptime Kuma avec les paramètres de statut.
 *
 * @param {string} baseUrl URL de push fournie par Uptime Kuma
 * @param {'up'|'down'} status
 * @param {string} msg Message affiché dans l'historique de la sonde
 * @param {number|null} ping Latence à enregistrer, en millisecondes
 * @returns {string}
 */
function buildPushUrl(baseUrl, status, msg, ping) {
    const url = new URL(baseUrl);
    url.searchParams.set('status', status);
    url.searchParams.set('msg', msg);

    if (ping !== null && Number.isFinite(ping) && ping >= 0) {
        url.searchParams.set('ping', String(Math.round(ping)));
    }

    return url.toString();
}

/**
 * Détermine l'état à remonter à partir de l'état réel du client Discord.
 *
 * @param {import('discord.js').Client} client
 * @returns {{status: 'up'|'down', msg: string, ping: number|null}}
 */
function buildHeartbeatPayload(client) {
    if (!client.isReady()) {
        return {
            status: 'down',
            msg: 'Client Discord non connecté',
            ping: null,
        };
    }

    // discord.js retourne -1 tant qu'aucun heartbeat websocket n'a été échangé.
    const ping = client.ws.ping >= 0 ? client.ws.ping : null;

    if (ping !== null && ping > DEGRADED_PING_MS) {
        return {
            status: 'up',
            msg: `Connecté, latence websocket dégradée (${Math.round(ping)} ms)`,
            ping,
        };
    }

    const guilds = client.guilds.cache.size;
    const commands = client.commands?.size ?? 0;

    return {
        status: 'up',
        msg: `Connecté — ${guilds} serveur(s), ${commands} commande(s) chargée(s)`,
        ping,
    };
}

/**
 * Démarre l'émission périodique du heartbeat.
 *
 * L'absence de configuration n'est pas une erreur : en développement local, la
 * variable n'est pas définie et le bot doit démarrer normalement sans
 * supervision.
 *
 * @param {import('discord.js').Client} client
 * @returns {NodeJS.Timeout|null} Le timer, ou null si la sonde est désactivée
 */
function initHeartbeat(client) {
    const pushUrl = process.env.UPTIME_KUMA_PUSH_URL;

    if (!pushUrl) {
        console.log('[heartbeat] UPTIME_KUMA_PUSH_URL non défini — supervision désactivée.');
        return null;
    }

    const intervalSeconds = Number.parseInt(
        process.env.UPTIME_KUMA_PUSH_INTERVAL ?? String(DEFAULT_INTERVAL_SECONDS),
        10,
    ) || DEFAULT_INTERVAL_SECONDS;

    const send = async () => {
        const { status, msg, ping } = buildHeartbeatPayload(client);

        try {
            // Timeout court : si Uptime Kuma est injoignable, on ne veut pas
            // accumuler des requêtes en attente à chaque tick.
            const response = await fetch(buildPushUrl(pushUrl, status, msg, ping), {
                method: 'GET',
                signal: AbortSignal.timeout(5000),
            });

            if (!response.ok) {
                console.warn(`[heartbeat] Uptime Kuma a répondu ${response.status}.`);
            }
        } catch (error) {
            // Un échec d'émission ne doit jamais interrompre le bot : la
            // supervision est un service annexe, pas une dépendance critique.
            console.warn(`[heartbeat] Échec de l'émission : ${error.message}`);
        }
    };

    // Première émission immédiate pour ne pas laisser la sonde en attente
    // pendant tout l'intervalle après un redéploiement.
    send();

    const timer = setInterval(send, intervalSeconds * 1000);

    // unref() évite que ce timer maintienne le process Node en vie lors d'un
    // arrêt propre du conteneur.
    timer.unref();

    console.log(`[heartbeat] Supervision active — émission toutes les ${intervalSeconds}s.`);

    return timer;
}

module.exports = {
    buildPushUrl,
    buildHeartbeatPayload,
    initHeartbeat,
};
