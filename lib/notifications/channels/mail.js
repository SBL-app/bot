'use strict';

const { CHANNELS } = require('../events');
const { registerChannel } = require('../notify');

const escapeHtml = (v) =>
    String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Templates par type d'événement : payload → { subject, lines[] }. */
const TEMPLATES = Object.freeze({
    'match.scheduled': (p) => ({
        subject: `Match programmé (#${p.matchId})`,
        lines: [`Votre match #${p.matchId} est programmé le ${p.date}.`],
    }),
    'match.reminder': (p) => ({
        subject: `Rappel : match #${p.matchId}`,
        lines: [`Rappel : votre match #${p.matchId} a lieu le ${p.date}.`],
    }),
    'match.result_entered': (p) => ({
        subject: `Résultat du match #${p.matchId}`,
        lines: [`Le résultat du match #${p.matchId} a été saisi : ${p.score}.`],
    }),
    'ranking.changed': (p) => ({
        subject: 'Classement mis à jour',
        lines: [`Le classement de la compétition ${p.competitionId} a changé.`],
    }),
    'match.result_deadline': (p) => ({
        subject: `Saisie du résultat à effectuer (match #${p.matchId})`,
        lines: [`Merci de saisir le résultat du match #${p.matchId} avant le ${p.deadline}.`],
    }),
});

function render(event) {
    const tpl = TEMPLATES[event.type];
    if (!tpl) throw new Error(`Pas de template mail pour ${event.type}`);
    const { subject, lines } = tpl(event.payload || {});
    return {
        subject,
        text: lines.join('\n'),
        html: lines.map((l) => `<p>${escapeHtml(l)}</p>`).join(''),
    };
}

/**
 * @param {{transport: {sendMail: Function}, from: string}} opts
 */
function createMailChannel({ transport, from }) {
    if (!transport || typeof transport.sendMail !== 'function') throw new Error('transport.sendMail requis');
    if (!from) throw new Error('Expéditeur (from) requis');
    return {
        async send(event, user) {
            if (!user || !user.email) throw new Error(`Utilisateur ${user && user.id} sans adresse mail`);
            const { subject, text, html } = render(event);
            await transport.sendMail({ from, to: user.email, subject, text, html });
        },
    };
}

/**
 * Enregistre le canal mail si SMTP_URL et MAIL_FROM sont définis.
 * @returns {boolean} true si le canal a été enregistré
 */
function registerMailChannelFromEnv(env = process.env) {
    if (!env.SMTP_URL || !env.MAIL_FROM) return false;
    const transport = require('nodemailer').createTransport(env.SMTP_URL);
    registerChannel(CHANNELS.MAIL, createMailChannel({ transport, from: env.MAIL_FROM }));
    return true;
}

module.exports = { createMailChannel, registerMailChannelFromEnv, render, TEMPLATES };
