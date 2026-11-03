import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { notify, registerChannel, unregisterChannel, EVENTS } = require('../lib/notifications');
const { createMobileChannel, registerMobileChannelFromEnv } = require('../lib/notifications/channels/mobile');

afterEach(() => unregisterChannel('mobile'));

describe('canal mobile', () => {
    it('appelle POST /push/send avec la clé de service via notify()', async () => {
        const fetchImpl = vi.fn().mockResolvedValue({ ok: true });
        registerChannel('mobile', createMobileChannel({ apiUrl: 'http://api/api', apiKey: 'k', fetchImpl }));
        const ev = { type: EVENTS.MATCH_REMINDER.type, payload: { matchId: 3, date: 'demain' } };
        const r = await notify(ev, [{ id: 'u1', notificationPreferences: { [ev.type]: ['mobile'] } }]);
        expect(r.sent).toBe(1);
        const [url, init] = fetchImpl.mock.calls[0];
        expect(url).toBe('http://api/api/push/send');
        expect(init.headers['X-Service-Key']).toBe('k');
        expect(JSON.parse(init.body)).toMatchObject({ userId: 'u1', title: 'SBL' });
    });
    it('remonte une erreur HTTP', async () => {
        const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 401 });
        const ch = createMobileChannel({ apiUrl: 'http://a', apiKey: 'k', fetchImpl });
        await expect(ch.send({ type: 'match.reminder', payload: {} }, { id: 'u' })).rejects.toThrow('401');
    });
    it("n'enregistre rien sans PUSH_SERVICE_KEY", () => {
        expect(registerMobileChannelFromEnv({}, 'http://a')).toBe(false);
        expect(registerMobileChannelFromEnv({ PUSH_SERVICE_KEY: 'k' }, 'http://a')).toBe(true);
    });
});
