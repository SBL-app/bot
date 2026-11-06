'use strict';

const { CHANNELS } = require('../events');
const { registerChannel } = require('../notify');

const WEBHOOK_RE = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

/** Messages par type d'événement : payload → texte. */
const TEMPLATES = Object.freeze({
    'match.scheduled': (p) => `📅 Match #${p.matchId} programmé le ${p.date}.`,
    'match.reminder': (p) => `⏰ Rappel : le match #${p.matchId} a lieu le ${p.date}.`,
    'match.result_entered': (p) => `✅ Résultat du match #${p.matchId} saisi : ${p.score}.`,
    'ranking.changed': (p) => `🏆 Le classement de la compétition ${p.competitionId} a changé.`,
    'match.result_deadline': (p) => `⚠️ Saisir le résultat du match #${p.matchId} avant le ${p.deadline}.`,
});

function render(event, user) {
    const tpl = TEMPLATES[event.type];
    if (!tpl) throw new Error(`Pas de template Discord pour ${event.type}`);
    const id = user && user.discordId ? String(user.discordId) : null;
    return {
        content: (id ? `<@${id}> ` : '') + tpl(event.payload || {}),
        allowed_mentions: { users: id ? [id] : [] },
    };
}

/**
 * @param {{webhookUrl: string, fetchImpl?: Function}} opts
 */
function createDiscordChannel({ webhookUrl, fetchImpl = globalThis.fetch }) {
    if (!WEBHOOK_RE.test(webhookUrl || '')) throw new Error('URL de webhook Discord invalide');
    if (typeof fetchImpl !== 'function') throw new Error('fetch indisponible');
    return {
        async send(event, user) {
            const res = await fetchImpl(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(render(event, user)),
            });
            if (!res.ok) throw new Error(`Webhook Discord : HTTP ${res.status}`);
        },
    };
}

/**
 * Enregistre le canal Discord si DISCORD_WEBHOOK_URL est défini.
 * @returns {boolean} true si le canal a été enregistré
 */
function registerDiscordChannelFromEnv(env = process.env) {
    if (!env.DISCORD_WEBHOOK_URL) return false;
    registerChannel(CHANNELS.DISCORD, createDiscordChannel({ webhookUrl: env.DISCORD_WEBHOOK_URL }));
    return true;
}

module.exports = { createDiscordChannel, registerDiscordChannelFromEnv, render, TEMPLATES };
