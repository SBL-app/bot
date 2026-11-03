import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { notify, registerChannel, unregisterChannel, EVENTS } = require('../lib/notifications');
const { createMailChannel, registerMailChannelFromEnv, TEMPLATES } = require('../lib/notifications/channels/mail');

afterEach(() => unregisterChannel('mail'));

describe('canal mail', () => {
    it('a un template pour chaque événement du catalogue', () => {
        Object.values(EVENTS).forEach((e) => expect(TEMPLATES[e.type]).toBeTypeOf('function'));
    });
    it('envoie via notify() avec expéditeur et destinataire', async () => {
        const sendMail = vi.fn().mockResolvedValue();
        registerChannel('mail', createMailChannel({ transport: { sendMail }, from: 'SBL <no-reply@sbl.test>' }));
        const ev = { type: EVENTS.RESULT_DEADLINE.type, payload: { matchId: 7, deadline: '<b>demain</b>' } };
        const r = await notify(ev, [{ id: 'u1', email: 'a@b.fr' }]);
        expect(r.sent).toBe(1);
        const m = sendMail.mock.calls[0][0];
        expect(m).toMatchObject({ from: 'SBL <no-reply@sbl.test>', to: 'a@b.fr' });
        expect(m.html).toContain('&lt;b&gt;demain');
    });
    it('échoue proprement sans adresse mail', async () => {
        const ch = createMailChannel({ transport: { sendMail: vi.fn() }, from: 'x@y.z' });
        await expect(ch.send({ type: 'match.reminder', payload: {} }, { id: 'u' })).rejects.toThrow(/sans adresse/);
    });
    it("n'enregistre rien sans configuration", () => {
        expect(registerMailChannelFromEnv({})).toBe(false);
    });
});
