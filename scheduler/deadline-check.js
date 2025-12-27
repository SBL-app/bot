const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const config = require('../config.json');

const settingsConfigPath = path.join(__dirname, '../config/settings.json');

const DAYS_INDEX = {
    'sunday': 0,
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6
};

function loadSettingsConfig() {
    try {
        return JSON.parse(fs.readFileSync(settingsConfigPath, 'utf8'));
    } catch (error) {
        return { deadline_day: 'thursday', default_match_day: 'sunday', default_match_time: '21:00' };
    }
}

function getNextDayOfWeek(dayName, time, baseDate = new Date()) {
    const targetDay = DAYS_INDEX[dayName.toLowerCase()];
    if (targetDay === undefined) return null;

    const result = new Date(baseDate);
    const currentDay = result.getDay();
    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget <= 0) {
        daysUntilTarget += 7;
    }

    result.setDate(result.getDate() + daysUntilTarget);

    const timeParts = time.split(':');
    result.setHours(parseInt(timeParts[0]) || 21, parseInt(timeParts[1]) || 0, 0, 0);

    return result;
}

async function fetchCurrentSeasonWeek() {
    try {
        const response = await fetch(`${config.apiUrl}/season/current/week`, {
            headers: { 'User-Agent': 'SBL-Discord-Bot', 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error('[Deadline] Erreur fetch season week:', error);
        return null;
    }
}

async function fetchUnscheduledGames(week, seasonId) {
    try {
        const response = await fetch(`${config.apiUrl}/games/unscheduled?week=${week}&season_id=${seasonId}`, {
            headers: { 'User-Agent': 'SBL-Discord-Bot', 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error('[Deadline] Erreur fetch unscheduled games:', error);
        return [];
    }
}

async function scheduleGame(gameId, date) {
    try {
        const response = await fetch(`${config.apiUrl}/games/${gameId}/schedule`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'SBL-Discord-Bot',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ date: date.toISOString() }),
            signal: AbortSignal.timeout(15000)
        });
        return response.ok;
    } catch (error) {
        console.error(`[Deadline] Erreur schedule game ${gameId}:`, error);
        return false;
    }
}

async function checkAndApplyDeadline(client) {
    const settings = loadSettingsConfig();
    const today = new Date();
    const currentDayIndex = today.getDay();
    const deadlineDayIndex = DAYS_INDEX[settings.deadline_day];

    // Vérifier si nous sommes le jour après le jour butoir
    // Par exemple, si deadline = jeudi (4), on vérifie vendredi (5)
    const dayAfterDeadline = (deadlineDayIndex + 1) % 7;

    if (currentDayIndex !== dayAfterDeadline) {
        console.log(`[Deadline] Pas le jour de vérification (aujourd'hui: ${currentDayIndex}, attendu: ${dayAfterDeadline})`);
        return;
    }

    console.log('[Deadline] Vérification des matchs non planifiés...');

    const seasonWeek = await fetchCurrentSeasonWeek();
    if (!seasonWeek) {
        console.log('[Deadline] Aucune saison en cours.');
        return;
    }

    const unscheduledGames = await fetchUnscheduledGames(seasonWeek.current_week, seasonWeek.season_id);
    if (unscheduledGames.length === 0) {
        console.log('[Deadline] Tous les matchs de la semaine sont planifiés.');
        return;
    }

    console.log(`[Deadline] ${unscheduledGames.length} match(s) non planifié(s) trouvé(s).`);

    // Calculer la date par défaut
    const defaultDate = getNextDayOfWeek(settings.default_match_day, settings.default_match_time);
    if (!defaultDate) {
        console.error('[Deadline] Impossible de calculer la date par défaut.');
        return;
    }

    console.log(`[Deadline] Application de l'horaire par défaut: ${defaultDate.toLocaleString('fr-FR')}`);

    // Planifier chaque match non planifié
    for (const game of unscheduledGames) {
        const success = await scheduleGame(game.id, defaultDate);
        if (success) {
            console.log(`[Deadline] Match #${game.id} planifié avec succès.`);

            // Notifier les capitaines si possible (TODO: récupérer les discord_id des capitaines)
        } else {
            console.error(`[Deadline] Échec de la planification du match #${game.id}.`);
        }
    }
}

function initDeadlineScheduler(client) {
    // Exécuter tous les jours à minuit (heure locale)
    cron.schedule('0 0 * * *', async () => {
        console.log('[Deadline] Exécution de la vérification du jour butoir...');
        await checkAndApplyDeadline(client);
    }, {
        timezone: 'Europe/Paris'
    });

    console.log('[Deadline] Scheduler du jour butoir initialisé (minuit chaque jour).');
}

// Fonction pour tester manuellement
async function runDeadlineCheckNow(client) {
    console.log('[Deadline] Exécution manuelle de la vérification...');
    await checkAndApplyDeadline(client);
}

module.exports = {
    initDeadlineScheduler,
    runDeadlineCheckNow,
    checkAndApplyDeadline
};
