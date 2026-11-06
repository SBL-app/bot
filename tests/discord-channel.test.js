import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { notify, registerChannel, unregisterChannel, EVENTS } = require('../lib/notifications');
const {
    createDiscordChannel,
    registerDiscordChannelFromEnv,
    TEMPLATES,
} = require('../lib/notifications/channels/discord');

const URL = 'https://discord.com/api/webhooks/123456/abc-DEF_1';
afterEach(() => unregisterChannel('discord'));

describe('canal discord', () => {
    it('a un message pour chaque événement du catalogue', () => {
        Object.values(EVENTS).forEach((e) => expect(TEMPLATES[e.type]).toBeTypeOf('function'));
    });
    it('poste sur le webhook via notify() avec mention', async () => {
        const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
        registerChannel('discord', createDiscordChannel({ webhookUrl: URL, fetchImpl }));
        const ev = { type: EVENTS.RESULT_DEADLINE.type, payload: { matchId: 7, deadline: 'demain' } };
        const r = await notify(ev, [{ id: 'u1', discordId: '42', notificationPreferences: { [ev.type]: ['discord'] } }]);
        expect(r.sent).toBe(1);
        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe(URL);
        const body = JSON.parse(init.body);
        expect(body.content).toContain('<@42>');
        expect(body.allowed_mentions.users).toEqual(['42']);
    });
    it('remonte une erreur HTTP', async () => {
        const ch = createDiscordChannel({ webhookUrl: URL, fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 429 }) });
        await expect(ch.send({ type: 'match.reminder', payload: {} }, { id: 'u' })).rejects.toThrow(/429/);
    });
    it('refuse une URL invalide', () => {
        expect(() => createDiscordChannel({ webhookUrl: 'http://evil.test/x' })).toThrow(/invalide/);
    });
    it("n'enregistre rien sans configuration", () => {
        expect(registerDiscordChannelFromEnv({})).toBe(false);
    });
});
