'use strict';

const { getEventDefinition } = require('./events');

/** Registre des canaux : nom → { send(event, user) → Promise }. */
const channels = new Map();

function registerChannel(name, channel) {
    if (typeof name !== 'string' || !name) throw new Error('Nom de canal invalide');
    if (!channel || typeof channel.send !== 'function') {
        throw new Error(`Le canal "${name}" doit exposer send(event, user)`);
    }
    channels.set(name, channel);
}

function unregisterChannel(name) {
    channels.delete(name);
}

/**
 * Canaux à utiliser pour un utilisateur : préférence explicite
 * (user.notificationPreferences[type] = ['discord', ...]) sinon défaut de l'événement.
 */
function resolveChannels(definition, user) {
    const pref = user && user.notificationPreferences && user.notificationPreferences[definition.type];
    return Array.isArray(pref) ? pref : definition.defaultChannels;
}

/**
 * Envoie un événement à des utilisateurs via les canaux enregistrés.
 * Un échec sur un canal/utilisateur n'interrompt pas les autres.
 *
 * @param {{type: string, payload?: object}} event
 * @param {Array<{id: string, notificationPreferences?: object}>} users
 * @returns {Promise<{sent: number, failed: number, skipped: number, errors: Array}>}
 */
async function notify(event, users) {
    const definition = event && getEventDefinition(event.type);
    if (!definition) throw new Error(`Événement inconnu : ${event && event.type}`);
    const payload = event.payload || {};
    const missing = definition.required.filter((k) => payload[k] === undefined);
    if (missing.length) throw new Error(`Payload incomplet pour ${event.type} : ${missing.join(', ')}`);

    const result = { sent: 0, failed: 0, skipped: 0, errors: [] };
    for (const user of users || []) {
        for (const name of resolveChannels(definition, user)) {
            const channel = channels.get(name);
            if (!channel) {
                result.skipped++;
                continue;
            }
            try {
                await channel.send({ type: event.type, payload }, user);
                result.sent++;
            } catch (error) {
                result.failed++;
                result.errors.push({ channel: name, userId: user.id, message: error.message });
            }
        }
    }
    return result;
}

module.exports = { notify, registerChannel, unregisterChannel, resolveChannels };
