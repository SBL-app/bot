import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchAPI } from '../apiConfig.js';

/** Construit une fausse Response minimale pour mocker fetch. */
function mockResponse({ ok = true, status = 200, json = {}, contentType = 'application/json', text = '' }) {
    return {
        ok,
        status,
        headers: { get: () => contentType },
        json: async () => json,
        text: async () => text,
    };
}

describe('fetchAPI', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('retourne les données en cas de succès', async () => {
        fetch.mockResolvedValueOnce(mockResponse({ json: { id: 1, name: 'Saison 1' } }));
        const res = await fetchAPI('/seasons');
        expect(res.error).toBeNull();
        expect(res.status).toBe(200);
        expect(res.data).toEqual({ id: 1, name: 'Saison 1' });
    });

    it('signale une réponse non-JSON', async () => {
        fetch.mockResolvedValueOnce(
            mockResponse({ contentType: 'text/html', text: '<html>error</html>' }),
        );
        const res = await fetchAPI('/seasons');
        expect(res.data).toBeNull();
        expect(res.error).toMatch(/non-JSON/i);
    });

    it('remonte les erreurs HTTP', async () => {
        fetch.mockResolvedValueOnce(
            mockResponse({ ok: false, status: 404, json: { error: 'Introuvable' } }),
        );
        const res = await fetchAPI('/seasons/999');
        expect(res.data).toBeNull();
        expect(res.status).toBe(404);
        expect(res.error).toBe('Introuvable');
    });

    it('gère un timeout', async () => {
        const err = new Error('timeout');
        err.name = 'TimeoutError';
        fetch.mockRejectedValueOnce(err);
        const res = await fetchAPI('/seasons');
        expect(res.status).toBe(0);
        expect(res.error).toMatch(/Timeout/i);
    });

    it('gère un serveur introuvable', async () => {
        const err = new Error('dns');
        err.code = 'ENOTFOUND';
        fetch.mockRejectedValueOnce(err);
        const res = await fetchAPI('/seasons');
        expect(res.error).toMatch(/introuvable/i);
    });
});
