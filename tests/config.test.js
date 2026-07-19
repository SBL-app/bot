import { describe, it, expect, vi, afterEach } from 'vitest';

/**
 * config.js fige ses valeurs au chargement du module : on réinitialise donc
 * le cache de modules et on redéfinit l'environnement avant chaque import.
 */
async function loadConfig(env) {
    vi.resetModules();
    for (const [key, value] of Object.entries(env)) {
        vi.stubEnv(key, value);
    }
    return import('../lib/config.js');
}

afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
});

describe('config', () => {
    it('lit les secrets depuis les variables d\'environnement', async () => {
        const config = (await loadConfig({
            DISCORD_TOKEN: 'tok-123',
            DISCORD_CLIENT_ID: 'app-456',
            API_URL: 'https://api.example.test',
        })).default;

        expect(config.token).toBe('tok-123');
        expect(config.applicationId).toBe('app-456');
        expect(config.apiUrl).toBe('https://api.example.test');
    });

    it('assertConfig réussit quand les clés requises sont présentes', async () => {
        const mod = await loadConfig({
            DISCORD_TOKEN: 'tok',
            DISCORD_CLIENT_ID: 'app',
        });
        expect(() => mod.default.assertConfig(['token', 'applicationId'])).not.toThrow();
    });

    it('assertConfig lève une erreur listant les clés manquantes', async () => {
        const mod = await loadConfig({
            DISCORD_TOKEN: '',
            DISCORD_CLIENT_ID: '',
        });
        expect(() => mod.default.assertConfig(['token', 'applicationId'])).toThrow(/token/);
    });
});
