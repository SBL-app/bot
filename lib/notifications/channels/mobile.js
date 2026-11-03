'use strict';

const { CHANNELS } = require('../events');
const { registerChannel } = require('../notify');
const { TEMPLATES } = require('./discord');

/**
 * Canal mobile (Web Push) : délègue l'envoi à l'API (POST /push/send),
 * qui détient les subscriptions et les clés VAPID.
 * @param {{apiUrl: string, apiKey: string, fetchImpl?: Function}} opts
 */
function createMobileChannel({ apiUrl, apiKey, fetchImpl = globalThis.fetch }) {
    if (!apiUrl) throw new Error('apiUrl requis');
    if (!apiKey) throw new Error('clé de service requise');
    if (typeof fetchImpl !== 'function') throw new Error('fetch indisponible');
    return {
        async send(event, user) {
            const tpl = TEMPLATES[event.type];
            if (!tpl) throw new Error(`Pas de template mobile pour ${event.type}`);
            const res = await fetchImpl(`${apiUrl}/push/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Service-Key': apiKey },
                body: JSON.stringify({
                    userId: user.id,
                    title: 'SBL',
                    body: tpl(event.payload || {}),
                    url: '/',
                }),
                signal: AbortSignal.timeout(15000),
            });
            if (!res.ok) throw new Error(`Push API : HTTP ${res.status}`);
        },
    };
}

/** Enregistre le canal si PUSH_SERVICE_KEY est défini. @returns {boolean} */
function registerMobileChannelFromEnv(env = process.env, apiUrl = require('../../config').apiUrl) {
    if (!env.PUSH_SERVICE_KEY) return false;
    registerChannel(CHANNELS.MOBILE, createMobileChannel({ apiUrl, apiKey: env.PUSH_SERVICE_KEY }));
    return true;
}

module.exports = { createMobileChannel, registerMobileChannelFromEnv };
