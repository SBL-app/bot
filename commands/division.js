import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { ApiClient, ApiError } from '../utils/apiClient.js';

export const data = new SlashCommandBuilder()
    .setName('division')
    .setDescription('Affiche les détails d\'une division spécifique')
    .addIntegerOption(option => option.setName('id')
        .setDescription('ID de la division à afficher')
        .setRequired(true)
        .setMinValue(1));
export async function execute(interaction) {
    // Répondre immédiatement pour éviter le timeout seulement si ce n'est pas déjà fait
    if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Récupération des détails de la division...', ephemeral: true });
    }

    try {
        const divisionId = interaction.options.getInteger('id');
        const apiClient = new ApiClient();

        // Récupérer toutes les informations de la division en une seule requête
        const result = await apiClient.getDivisionDetails(divisionId);
        const data = result.data;
        const responseTime = result.responseTime;

        // Vérifier si les données sont présentes
        if (!data || !data.division) {
            throw new Error(`Division avec l'ID ${divisionId} non trouvée`);
        }

        const { division, ranking, teams_count, games, teams } = data;

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
        divisionInfo += `📅 **Saison:** ${division.season_name} (ID: ${division.season_id})\n`;
        divisionInfo += `👥 **Nombre d'équipes:** ${teams_count}`;

        embed.addFields({
            name: 'ℹ️ Informations générales',
            value: divisionInfo,
            inline: false
        });

        // Afficher le classement des équipes
        if (ranking && ranking.length > 0) {
            let rankingText = '';

            ranking.forEach((team, index) => {
                const position = team.position || (index + 1);
                const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
                const stats = team.stats;

                rankingText += `${medal} **${team.team_name}**\n`;
                rankingText += `   📊 ${stats.wins}V - ${stats.losses}D - ${stats.ties}N | ${stats.points} pts\n\n`;
            });

            // Limiter la longueur pour éviter la limite Discord
            if (rankingText.length > 1000) {
                rankingText = rankingText.substring(0, 950) + '...\n*(Classement tronqué)*';
            }

            embed.addFields({
                name: '📊 Classement',
                value: rankingText,
                inline: false
            });
        }

        // Afficher les derniers matchs joués
        if (games && games.length > 0) {
            let gamesInfo = '';
            let totalGames = 0;
            let finishedGames = 0;

            // Compter le total des matchs
            games.forEach(week => {
                if (week.games && Array.isArray(week.games)) {
                    totalGames += week.games.length;
                    finishedGames += week.games.filter(game => game.status === 'joué').length;
                }
            });

            gamesInfo += `🎮 **Total des matchs:** ${totalGames}\n`;
            gamesInfo += `✅ **Matchs terminés:** ${finishedGames}\n`;
            gamesInfo += `⏳ **Matchs en attente:** ${totalGames - finishedGames}\n`;

            // Progression
            if (totalGames > 0) {
                const percentage = (finishedGames / totalGames) * 100;
                const progressBar = generateProgressBar(percentage);
                gamesInfo += `📊 **Progression:** ${progressBar} ${percentage.toFixed(1)}%`;
            }

            embed.addFields({
                name: '🎯 Informations sur les matchs',
                value: gamesInfo,
                inline: false
            });

            // Afficher les derniers matchs joués
            const recentGames = [];
            games.forEach(week => {
                if (week.games) {
                    week.games.forEach(game => {
                        if (game.status === 'joué') {
                            recentGames.push({
                                ...game,
                                week: week.week
                            });
                        }
                    });
                }
            });

            // Trier par date et prendre les 3 derniers
            recentGames.sort((a, b) => new Date(b.date) - new Date(a.date));
            const lastGames = recentGames.slice(0, 3);

            if (lastGames.length > 0) {
                let recentGamesText = '';
                lastGames.forEach(game => {
                    const winnerIcon = game.winner === 1 ? '🟢' : game.winner === 2 ? '🔴' : '🟡';
                    recentGamesText += `${winnerIcon} **${game.team1}** ${game.score1} - ${game.score2} **${game.team2}**\n`;
                    recentGamesText += `   📅 ${game.date} • Semaine ${game.week}\n\n`;
                });

                embed.addFields({
                    name: '🕒 Derniers résultats',
                    value: recentGamesText,
                    inline: false
                });
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
                .setLabel(`Voir les matchs`)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⚽')
        );

        // Bouton pour retourner aux divisions de la saison
        if (division.season_id) {
            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`divisions_season_${division.season_id}`)
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
        );

        if (actionRow.components.length > 0) {
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
                { name: 'ID recherché', value: `Division ID: ${interaction.options.getInteger('id')}`, inline: false },
                { name: 'Données tentées', value: 'Informations de la division, matchs et statistiques des équipes', inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Récupération échouée' });

        await interaction.editReply({ content: null, embeds: [errorEmbed] });
    }
}

// Fonction utilitaire pour générer une barre de progression
function generateProgressBar(percentage, length = 10) {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    
    const filledBar = '█'.repeat(filled);
    const emptyBar = '░'.repeat(empty);
    
    return `${filledBar}${emptyBar}`;
}
