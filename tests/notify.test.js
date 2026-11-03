import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { notify, registerChannel, unregisterChannel, EVENTS } = require('../lib/notifications');

const ev = { type: EVENTS.MATCH_SCHEDULED.type, payload: { matchId: 1, date: 'd' } };

afterEach(() => ['discord', 'mail', 'mobile'].forEach(unregisterChannel));

describe('notify', () => {
    it('envoie sur les canaux par défaut et ignore les non enregistrés', async () => {
        const send = vi.fn().mockResolvedValue();
        registerChannel('discord', { send });
        const r = await notify(ev, [{ id: 'u1' }]);
        expect(send).toHaveBeenCalledOnce();
        expect(r).toMatchObject({ sent: 1, skipped: 2, failed: 0 });
    });
    it('respecte les préférences utilisateur', async () => {
        const send = vi.fn().mockResolvedValue();
        registerChannel('mail', { send });
        const r = await notify(ev, [{ id: 'u1', notificationPreferences: { [ev.type]: ['mail'] } }]);
        expect(r.sent).toBe(1);
    });
    it("isole les échecs d'un canal", async () => {
        registerChannel('discord', { send: vi.fn().mockRejectedValue(new Error('boom')) });
        registerChannel('mail', { send: vi.fn().mockResolvedValue() });
        const r = await notify(ev, [{ id: 'u1' }]);
        expect(r).toMatchObject({ sent: 1, failed: 1 });
        expect(r.errors[0].message).toBe('boom');
    });
    it('rejette événement inconnu ou payload incomplet', async () => {
        await expect(notify({ type: 'x' }, [])).rejects.toThrow();
        await expect(notify({ type: ev.type, payload: {} }, [])).rejects.toThrow(/incomplet/);
    });
});
