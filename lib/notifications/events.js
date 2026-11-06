'use strict';

/**
 * Catalogue des événements déclencheurs de notifications.
 *
 * Chaque événement définit :
 *  - recipients : qui est notifié (rôle logique, résolu par l'appelant)
 *  - defaultChannels : canaux activés par défaut (modifiable par préférence utilisateur)
 *  - required : champs obligatoires du payload
 */
const CHANNELS = Object.freeze({
    DISCORD: 'discord',
    MAIL: 'mail',
    MOBILE: 'mobile',
});

const RECIPIENTS = Object.freeze({
    TEAM_MEMBERS: 'team_members', // joueurs des équipes concernées
    CAPTAINS: 'captains', // capitaines des équipes concernées
    FOLLOWERS: 'followers', // utilisateurs suivant la compétition
});

const EVENTS = Object.freeze({
    MATCH_SCHEDULED: {
        type: 'match.scheduled',
        recipients: RECIPIENTS.TEAM_MEMBERS,
        defaultChannels: [CHANNELS.DISCORD, CHANNELS.MAIL, CHANNELS.MOBILE],
        required: ['matchId', 'date'],
    },
    MATCH_REMINDER: {
        type: 'match.reminder',
        recipients: RECIPIENTS.TEAM_MEMBERS,
        defaultChannels: [CHANNELS.DISCORD, CHANNELS.MOBILE],
        required: ['matchId', 'date'],
    },
    MATCH_RESULT_ENTERED: {
        type: 'match.result_entered',
        recipients: RECIPIENTS.TEAM_MEMBERS,
        defaultChannels: [CHANNELS.DISCORD, CHANNELS.MOBILE],
        required: ['matchId', 'score'],
    },
    RANKING_CHANGED: {
        type: 'ranking.changed',
        recipients: RECIPIENTS.FOLLOWERS,
        defaultChannels: [CHANNELS.DISCORD],
        required: ['competitionId'],
    },
    RESULT_DEADLINE: {
        type: 'match.result_deadline',
        recipients: RECIPIENTS.CAPTAINS,
        defaultChannels: [CHANNELS.DISCORD, CHANNELS.MAIL],
        required: ['matchId', 'deadline'],
    },
});

const EVENTS_BY_TYPE = Object.freeze(
    Object.fromEntries(Object.values(EVENTS).map((e) => [e.type, e]))
);

function getEventDefinition(type) {
    return EVENTS_BY_TYPE[type] || null;
}

module.exports = { CHANNELS, RECIPIENTS, EVENTS, getEventDefinition };
