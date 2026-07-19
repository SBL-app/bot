import { describe, it, expect, vi } from 'vitest';
import { notifyCaptains } from '../scheduler/deadline-check.js';

function makeClient(sendImpl) {
    const send = sendImpl ?? vi.fn().mockResolvedValue(undefined);
    const fetch = vi.fn(async (id) => ({ id, send }));
    return { client: { users: { fetch } }, fetch, send };
}

const date = new Date(2026, 0, 4, 21, 0, 0);

describe('notifyCaptains', () => {
    it('envoie un DM aux deux capitaines du match', async () => {
        const { client, fetch, send } = makeClient();
        const game = {
            id: 42,
            team1: 'Alpha',
            team2: 'Beta',
            team1_captain_discord: '111',
            team2_captain_discord: '222'
        };

        await notifyCaptains(client, game, date);

        expect(fetch).toHaveBeenCalledTimes(2);
        expect(fetch).toHaveBeenCalledWith('111');
        expect(fetch).toHaveBeenCalledWith('222');
        expect(send).toHaveBeenCalledTimes(2);
        expect(send.mock.calls[0][0]).toHaveProperty('embeds');
    });

    it('ne notifie qu\'une fois lorsque le même capitaine dirige les deux équipes', async () => {
        const { client, fetch, send } = makeClient();
        const game = {
            id: 7,
            team1: 'Alpha',
            team2: 'Beta',
            team1_captain_discord: '111',
            team2_captain_discord: '111'
        };

        await notifyCaptains(client, game, date);

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(send).toHaveBeenCalledTimes(1);
    });

    it('ignore les capitaines sans discord_id', async () => {
        const { client, fetch, send } = makeClient();
        const game = {
            id: 8,
            team1: 'Alpha',
            team2: 'Beta',
            team1_captain_discord: '111',
            team2_captain_discord: null
        };

        await notifyCaptains(client, game, date);

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledWith('111');
        expect(send).toHaveBeenCalledTimes(1);
    });

    it('reste résilient si un DM échoue et notifie tout de même l\'autre capitaine', async () => {
        const send = vi.fn().mockRejectedValue(new Error('DM fermé'));
        const { client, fetch } = makeClient(send);
        const game = {
            id: 9,
            team1: 'Alpha',
            team2: 'Beta',
            team1_captain_discord: '111',
            team2_captain_discord: '222'
        };

        await expect(notifyCaptains(client, game, date)).resolves.toBeUndefined();
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(send).toHaveBeenCalledTimes(2);
    });

    it('ne fait rien sans client', async () => {
        const game = { id: 10, team1_captain_discord: '111', team2_captain_discord: '222' };
        await expect(notifyCaptains(null, game, date)).resolves.toBeUndefined();
    });
});
