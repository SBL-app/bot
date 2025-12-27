const cron = require('node-cron');
const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../config.json');

const channelsConfigPath = path.join(__dirname, '../config/channels.json');

function loadChannelsConfig() {
    try {
        return JSON.parse(fs.readFileSync(channelsConfigPath, 'utf8'));
    } catch (error) {
        console.error('Erreur lors du chargement de channels.json:', error);
        return { matchs_channel_id: null, classement_channel_id: null };
    }
}

async function fetchCurrentSeasonWeek() {
    const response = await fetch(`${config.apiUrl}/season/current/week`, {
        headers: { 'User-Agent': 'SBL-Discord-Bot', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) return null;
    return await response.json();
}

async function fetchDivisions(seasonId) {
    const response = await fetch(`${config.apiUrl}/divisions?season_id=${seasonId}`, {
        headers: { 'User-Agent': 'SBL-Discord-Bot', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) return [];
    return await response.json();
}

async function fetchDivisionStandings(divisionId) {
    const response = await fetch(`${config.apiUrl}/division?id=${divisionId}`, {
        headers: { 'User-Agent': 'SBL-Discord-Bot', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) return null;
    return await response.json();
}

async function fetchWeekGames(week, seasonId) {
    const response = await fetch(`${config.apiUrl}/games/week?week=${week}&season_id=${seasonId}`, {
        headers: { 'User-Agent': 'SBL-Discord-Bot', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) return [];
    return await response.json();
}

async function sendWeeklyMatchesMessage(client) {
    const channelsConfig = loadChannelsConfig();
    if (!channelsConfig.matchs_channel_id) {
        console.log('[Scheduler] Aucun salon configuré pour les matchs.');
        return;
    }

    const channel = await client.channels.fetch(channelsConfig.matchs_channel_id).catch(() => null);
    if (!channel) {
        console.error('[Scheduler] Salon des matchs introuvable.');
        return;
    }

    try {
        const seasonWeek = await fetchCurrentSeasonWeek();
        if (!seasonWeek) {
            console.log('[Scheduler] Aucune saison en cours trouvée.');
            return;
        }

        const games = await fetchWeekGames(seasonWeek.current_week, seasonWeek.season_id);
        const divisions = await fetchDivisions(seasonWeek.season_id);

        // Grouper les matchs par division
        const gamesByDivision = {};
        games.forEach(game => {
            const divName = game.division || 'Sans division';
            if (!gamesByDivision[divName]) {
                gamesByDivision[divName] = [];
            }
            gamesByDivision[divName].push(game);
        });

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`Matchs de la semaine ${seasonWeek.current_week}`)
            .setDescription(`Saison: ${seasonWeek.season_name}`)
            .setTimestamp();

        if (games.length === 0) {
            embed.addFields({
                name: 'Aucun match',
                value: 'Aucun match prévu cette semaine.',
                inline: false
            });
        } else {
            for (const [divName, divGames] of Object.entries(gamesByDivision)) {
                const gamesText = divGames.map(game => {
                    const team1 = game.team1 || 'TBD';
                    const team2 = game.team2 || 'TBD';
                    let dateStr = 'Non planifié';
                    if (game.date) {
                        const date = new Date(game.date);
                        const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
                        dateStr = `${days[date.getDay()]} ${date.getHours()}h${String(date.getMinutes()).padStart(2, '0')}`;
                    }
                    return `• ${team1} vs ${team2} - ${dateStr}`;
                }).join('\n');

                embed.addFields({
                    name: `${divName}`,
                    value: gamesText.length > 1024 ? gamesText.substring(0, 1020) + '...' : gamesText,
                    inline: false
                });
            }
        }

        await channel.send({ embeds: [embed] });
        console.log('[Scheduler] Message des matchs de la semaine envoyé.');

    } catch (error) {
        console.error('[Scheduler] Erreur lors de l\'envoi des matchs:', error);
    }
}

async function sendWeeklyStandingsMessage(client) {
    const channelsConfig = loadChannelsConfig();
    if (!channelsConfig.classement_channel_id) {
        console.log('[Scheduler] Aucun salon configuré pour le classement.');
        return;
    }

    const channel = await client.channels.fetch(channelsConfig.classement_channel_id).catch(() => null);
    if (!channel) {
        console.error('[Scheduler] Salon du classement introuvable.');
        return;
    }

    try {
        const seasonWeek = await fetchCurrentSeasonWeek();
        if (!seasonWeek) {
            console.log('[Scheduler] Aucune saison en cours trouvée.');
            return;
        }

        const divisions = await fetchDivisions(seasonWeek.season_id);

        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle(`Classement - Semaine ${seasonWeek.current_week}`)
            .setDescription(`Saison: ${seasonWeek.season_name}`)
            .setTimestamp();

        for (const division of divisions) {
            const standings = await fetchDivisionStandings(division.id);
            if (!standings || !standings.teams) continue;

            const standingsText = standings.teams
                .sort((a, b) => (b.points || 0) - (a.points || 0))
                .slice(0, 10)
                .map((team, index) => {
                    const medal = index === 0 ? '' : index === 1 ? '' : index === 2 ? '' : `${index + 1}.`;
                    const wins = team.wins || 0;
                    const losses = team.losses || 0;
                    const points = team.points || 0;
                    return `${medal} **${team.name}** - ${points} pts (${wins}V/${losses}D)`;
                }).join('\n');

            if (standingsText) {
                embed.addFields({
                    name: `${division.name}`,
                    value: standingsText,
                    inline: false
                });
            }
        }

        if (!embed.data.fields || embed.data.fields.length === 0) {
            embed.addFields({
                name: 'Classement',
                value: 'Aucun classement disponible.',
                inline: false
            });
        }

        await channel.send({ embeds: [embed] });
        console.log('[Scheduler] Message du classement envoyé.');

    } catch (error) {
        console.error('[Scheduler] Erreur lors de l\'envoi du classement:', error);
    }
}

function initWeeklyScheduler(client) {
    // Exécuter tous les lundis à 8h00 (heure locale)
    cron.schedule('0 8 * * 1', async () => {
        console.log('[Scheduler] Exécution des messages hebdomadaires...');
        await sendWeeklyMatchesMessage(client);
        await sendWeeklyStandingsMessage(client);
    }, {
        timezone: 'Europe/Paris'
    });

    console.log('[Scheduler] Scheduler hebdomadaire initialisé (Lundi 8h00).');
}

// Fonction pour tester les messages manuellement
async function sendWeeklyMessagesNow(client) {
    console.log('[Scheduler] Envoi manuel des messages hebdomadaires...');
    await sendWeeklyMatchesMessage(client);
    await sendWeeklyStandingsMessage(client);
}

module.exports = {
    initWeeklyScheduler,
    sendWeeklyMessagesNow,
    sendWeeklyMatchesMessage,
    sendWeeklyStandingsMessage
};
