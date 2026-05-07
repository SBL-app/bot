const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { API_URL } = require('../apiConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('division')
        .setDescription('Affiche les détails d\'une division spécifique')
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('ID de la division à afficher')
                .setRequired(true)
                .setMinValue(1)),
    
    async execute(interaction) {
        // Répondre immédiatement pour éviter le timeout seulement si ce n'est pas déjà fait
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Récupération des détails de la division...', ephemeral: true });
        }
        
        try {
            const divisionId = interaction.options.getInteger('id');
            const startTime = Date.now();
            
            // Faire les 3 requêtes en parallèle pour optimiser les performances
            const [divisionResponse, gamesResponse, statsResponse] = await Promise.allSettled([
                // 1. Informations de base de la division
                fetch(`${API_URL}/divisions/${divisionId}`, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'SBL-Discord-Bot',
                        'Accept': 'application/json'
                    },
                    signal: AbortSignal.timeout(15000)
                }),
                // 2. Matchs de la division
                fetch(`${API_URL}/games?division_id=${divisionId}`, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'SBL-Discord-Bot',
                        'Accept': 'application/json'
                    },
                    signal: AbortSignal.timeout(15000)
                }),
                // 3. Statistiques des équipes
                fetch(`${API_URL}/team-stats?division_id=${divisionId}`, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'SBL-Discord-Bot',
                        'Accept': 'application/json'
                    },
                    signal: AbortSignal.timeout(15000)
                })
            ]);
            
            const responseTime = Date.now() - startTime;
            
            // Vérifier si la requête principale (division) a réussi
            if (divisionResponse.status === 'rejected' || !divisionResponse.value.ok) {
                if (divisionResponse.value && divisionResponse.value.status === 404) {
                    throw new Error(`Division avec l'ID ${divisionId} non trouvée`);
                }
                throw new Error(`Erreur lors de la récupération de la division: ${divisionResponse.reason || 'Erreur inconnue'}`);
            }
            
            const division = await divisionResponse.value.json();
            
            if (!division || !division.id) {
                throw new Error('Format de données non reconnu pour la division');
            }
            
            // Traiter les matchs (optionnel)
            let games = [];
            if (gamesResponse.status === 'fulfilled' && gamesResponse.value.ok) {
                try {
                    games = await gamesResponse.value.json();
                    if (!Array.isArray(games)) {
                        games = [];
                    }
                } catch (e) {
                    games = [];
                }
            }
            
            // Traiter les statistiques (optionnel)
            let teamStats = [];
            if (statsResponse.status === 'fulfilled' && statsResponse.value.ok) {
                try {
                    teamStats = await statsResponse.value.json();
                    if (!Array.isArray(teamStats)) {
                        teamStats = [];
                    }
                } catch (e) {
                    teamStats = [];
                }
            }
            
            // Créer l'embed principal
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`🏆 ${division.name || `Division ${division.id}`}`)
                .setDescription(`Détails complets de la division ID: **${division.id}**`)
                .setTimestamp()
                .setFooter({ text: `Récupéré en ${responseTime}ms` });
            
            // Informations de base de la division
            let divisionInfo = '';
            divisionInfo += `🆔 **ID:** ${division.id}\n`;
            if (division.season) {
                divisionInfo += `📅 **Saison:** ${division.season}\n`;
            }
            if (division.description) {
                divisionInfo += `📝 **Description:** ${division.description}\n`;
            }
            
            // Informations sur les équipes (depuis les données de division)
            if (division.teams && Array.isArray(division.teams)) {
                divisionInfo += `👥 **Nombre d'équipes:** ${division.teams.length}`;
            }
            
            embed.addFields({
                name: 'ℹ️ Informations générales',
                value: divisionInfo || 'Aucune information disponible',
                inline: false
            });
            
            // Afficher les statistiques des équipes si disponibles
            if (teamStats.length > 0) {
                let statsText = '';
                
                // Trier les équipes par points (décroissant), puis par victoires, puis par défaites
                const sortedStats = [...teamStats].sort((a, b) => {
                    if (b.points !== a.points) return b.points - a.points;
                    if (b.wins !== a.wins) return b.wins - a.wins;
                    return a.losses - b.losses;
                });
                
                sortedStats.slice(0, 10).forEach((team, index) => {
                    const position = index + 1;
                    const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
                    
                    statsText += `${medal} **${team.name || team.team_name || `Équipe ${team.team_id}`}**\n`;
                    statsText += `   ├ ${team.wins || 0}V - ${team.losses || 0}D - ${team.points || 0} pts\n`;
                    
                    // Ajouter d'autres statistiques si disponibles
                    if (team.goals_for !== undefined && team.goals_against !== undefined) {
                        const goalDiff = (team.goals_for || 0) - (team.goals_against || 0);
                        const goalDiffStr = goalDiff >= 0 ? `+${goalDiff}` : `${goalDiff}`;
                        statsText += `   └ Buts: ${team.goals_for || 0}-${team.goals_against || 0} (${goalDiffStr})\n`;
                    }
                });
                
                if (teamStats.length > 10) {
                    statsText += `\n... et ${teamStats.length - 10} autres équipes`;
                }
                
                if (statsText.length > 1024) {
                    statsText = statsText.substring(0, 1021) + '...';
                }
                
                embed.addFields({
                    name: '📊 Classement et statistiques',
                    value: statsText || 'Aucune statistique disponible',
                    inline: false
                });
            } else if (division.teams && division.teams.length > 0) {
                // Fallback: utiliser les données des équipes depuis la division
                let teamsText = '';
                
                const sortedTeams = [...division.teams].sort((a, b) => {
                    if (b.points !== a.points) return b.points - a.points;
                    if (b.wins !== a.wins) return b.wins - a.wins;
                    return a.losses - b.losses;
                });
                
                sortedTeams.slice(0, 10).forEach((team, index) => {
                    const position = index + 1;
                    const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
                    
                    teamsText += `${medal} **${team.name}** (ID: ${team.id})\n`;
                    teamsText += `   └ ${team.wins || 0}V - ${team.losses || 0}D - ${team.points || 0} pts\n`;
                });
                
                if (division.teams.length > 10) {
                    teamsText += `\n... et ${division.teams.length - 10} autres équipes`;
                }
                
                embed.addFields({
                    name: '👥 Équipes de la division',
                    value: teamsText || 'Aucune équipe trouvée',
                    inline: false
                });
            }
            
            // Informations sur les matchs
            if (games.length > 0) {
                let gamesInfo = `🎮 **Total des matchs:** ${games.length}\n`;
                
                // Compter les matchs terminés et à venir
                const finishedGames = games.filter(game => 
                    game.status === 'finished' || 
                    (game.home_score !== undefined && game.away_score !== undefined)
                ).length;
                const pendingGames = games.length - finishedGames;
                
                gamesInfo += `✅ **Matchs terminés:** ${finishedGames}\n`;
                gamesInfo += `⏳ **Matchs en attente:** ${pendingGames}\n`;
                
                // Progression
                if (games.length > 0) {
                    const percentage = (finishedGames / games.length) * 100;
                    const progressBar = generateProgressBar(percentage);
                    gamesInfo += `📊 **Progression:** ${progressBar} ${percentage.toFixed(1)}%`;
                }
                
                embed.addFields({
                    name: '🎯 Informations sur les matchs',
                    value: gamesInfo,
                    inline: false
                });
                
                // Afficher les derniers matchs
                if (finishedGames > 0) {
                    const recentFinished = games
                        .filter(game => game.status === 'finished' || (game.home_score !== undefined && game.away_score !== undefined))
                        .sort((a, b) => new Date(b.date || b.played_at || 0) - new Date(a.date || a.played_at || 0))
                        .slice(0, 3);
                    
                    let recentGamesText = '';
                    recentFinished.forEach(game => {
                        const homeTeam = game.home_team || game.home_team_name || 'Équipe A';
                        const awayTeam = game.away_team || game.away_team_name || 'Équipe B';
                        const homeScore = game.home_score || 0;
                        const awayScore = game.away_score || 0;
                        
                        recentGamesText += `⚽ **${homeTeam}** ${homeScore} - ${awayScore} **${awayTeam}**\n`;
                    });
                    
                    if (recentGamesText) {
                        embed.addFields({
                            name: '🕒 Derniers résultats',
                            value: recentGamesText,
                            inline: false
                        });
                    }
                }
            } else {
                embed.addFields({
                    name: '🎮 Matchs',
                    value: 'Aucun match trouvé pour cette division',
                    inline: false
                });
            }
            
            // Créer les boutons de navigation
            const components = [];
            const actionRow = new ActionRowBuilder();
            
            // Bouton pour voir tous les matchs de la division
            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`matchs_division_${division.id}_page_1`)
                    .setLabel(`Voir les matchs (${games.length})`)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('⚽')
            );
            
            // Bouton pour retourner aux divisions de la saison
            if (division.season) {
                actionRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`divisions_season_${division.season}`)
                        .setLabel('Divisions de la saison')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🏆')
                );
            }
            
            // Bouton pour retourner aux saisons
            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('back_to_seasons')
                    .setLabel('Toutes les saisons')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📅')
            );            if (actionRow.components.length > 0) {
                components.push(actionRow);
            }
            
            await interaction.editReply({ 
                content: null, 
                embeds: [embed],
                components: components
            });
            
        } catch (error) {
            let errorMessage = 'Erreur inconnue';
            
            if (error.name === 'TimeoutError') {
                errorMessage = 'Timeout - L\'API ne répond pas dans les temps';
            } else if (error.code === 'ENOTFOUND') {
                errorMessage = 'Impossible de résoudre le nom de domaine';
            } else if (error.code === 'ECONNREFUSED') {
                errorMessage = 'Connexion refusée par le serveur';
            } else if (error.message.includes('404') || error.message.includes('non trouvée')) {
                errorMessage = error.message;
            } else if (error.message.includes('500')) {
                errorMessage = 'Erreur interne du serveur API';
            } else {
                errorMessage = error.message || 'Erreur de connexion à l\'API';
            }
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Erreur - Détails de la division')
                .addFields(
                    { name: 'Erreur', value: errorMessage, inline: false },
                    { name: 'URLs tentées', value: [
                        `${API_URL}/division/${interaction.options.getInteger('id')}`,
                        `${API_URL}/games/${interaction.options.getInteger('id')}`,
                        `${API_URL}/teamStats/division/${interaction.options.getInteger('id')}`
                    ].join('\n'), inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'Récupération échouée' });
            
            await interaction.editReply({ content: null, embeds: [errorEmbed] });
        }
    },
};

// Fonction utilitaire pour générer une barre de progression
function generateProgressBar(percentage, length = 10) {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    
    const filledBar = '█'.repeat(filled);
    const emptyBar = '░'.repeat(empty);
    
    return `${filledBar}${emptyBar}`;
}
