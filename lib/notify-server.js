import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';

const MAX_BODY = 16 * 1024;
const ID_RE = /^\d{5,25}$/;

function safeEqual(a, b) {
    const x = Buffer.from(String(a));
    const y = Buffer.from(String(b));
    return x.length === y.length && timingSafeEqual(x, y);
}

function readJson(req) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', (c) => {
            size += c.length;
            if (size > MAX_BODY) {
                reject(Object.assign(new Error('too large'), { status: 413 }));
                req.destroy();
                return;
            }
            chunks.push(c);
        });
        req.on('end', () => {
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
            } catch {
                reject(Object.assign(new Error('invalid json'), { status: 400 }));
            }
        });
        req.on('error', reject);
    });
}

/**
 * Serveur HTTP minimal : POST /notify {discordId, title, body, url} avec X-Service-Key
 * → message privé Discord. Appelé par l'API (DiscordBotNotifier).
 * @param {{client: any, serviceKey: string, baseUrl?: string}} opts
 */
export function createNotifyServer({ client, serviceKey, baseUrl = '' }) {
    if (!serviceKey) throw new Error('DISCORD_BOT_NOTIFY_KEY requis');
    return createServer(async (req, res) => {
        const reply = (status, body = {}) => {
            res.writeHead(status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(body));
        };
        try {
            if (req.method !== 'POST' || req.url !== '/notify') return reply(404);
            if (!safeEqual(req.headers['x-service-key'] ?? '', serviceKey)) return reply(401);
            const { discordId, title, body, url } = await readJson(req);
            if (!ID_RE.test(String(discordId ?? '')) || typeof title !== 'string' || typeof body !== 'string') {
                return reply(400, { error: 'discordId, title et body requis' });
            }
            const link = typeof url === 'string' && url.startsWith('/') && baseUrl ? `\n${baseUrl}${url}` : '';
            const user = await client.users.fetch(String(discordId));
            await user.send({ content: `**${title}**\n${body}${link}`, allowedMentions: { parse: [] } });
            reply(204);
        } catch (e) {
            if (e.status) return reply(e.status, { error: e.message });
            console.error('Notification Discord échouée:', e.message);
            reply(502, { error: 'envoi impossible' });
        }
    });
}

/** Démarre le serveur si DISCORD_BOT_NOTIFY_KEY est défini. */
export function startNotifyServerFromEnv(client, env = process.env) {
    if (!env.DISCORD_BOT_NOTIFY_KEY) return null;
    const server = createNotifyServer({
        client,
        serviceKey: env.DISCORD_BOT_NOTIFY_KEY,
        baseUrl: env.FRONT_URL || '',
    });
    server.listen(Number(env.NOTIFY_PORT) || 3001);
    return server;
}
