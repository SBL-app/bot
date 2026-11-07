import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNotifyServer } from '../lib/notify-server.js';

async function start(client) {
    const server = createNotifyServer({ client, serviceKey: 'k', baseUrl: 'https://sbl.test' });
    await new Promise((r) => server.listen(0, r));
    const call = (body, key = 'k', path = '/notify') =>
        fetch(`http://127.0.0.1:${server.address().port}${path}`, {
            method: 'POST',
            headers: { 'X-Service-Key': key, 'Content-Type': 'application/json' },
            body: typeof body === 'string' ? body : JSON.stringify(body),
        });
    return { server, call };
}

test('envoie un MP et répond 204', async () => {
    const sent = [];
    const client = { users: { fetch: async (id) => ({ send: async (m) => sent.push([id, m]) }) } };
    const { server, call } = await start(client);
    const res = await call({ discordId: '123456789', title: 'T', body: 'B', url: '/matches/1' });
    server.close();
    assert.equal(res.status, 204);
    assert.equal(sent[0][0], '123456789');
    assert.equal(sent[0][1].content, '**T**\nB\nhttps://sbl.test/matches/1');
});

test('401 sans bonne clé, 400 sur payload invalide, 404 sur autre route', async () => {
    const { server, call } = await start({ users: { fetch: async () => ({ send: async () => {} }) } });
    assert.equal((await call({}, 'bad')).status, 401);
    assert.equal((await call({ discordId: 'x', title: 'T', body: 'B' })).status, 400);
    assert.equal((await call('pas du json')).status, 400);
    assert.equal((await call({}, 'k', '/autre')).status, 404);
    server.close();
});

test('502 si Discord refuse', async () => {
    const { server, call } = await start({ users: { fetch: async () => { throw new Error('x'); } } });
    const res = await call({ discordId: '123456789', title: 'T', body: 'B' });
    server.close();
    assert.equal(res.status, 502);
});
