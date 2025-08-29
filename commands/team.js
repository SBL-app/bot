const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ApiClient, ApiError } = require('../utils/apiClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('team')
        .setDescription('Affiche les informations détaillées d\'une équipe')
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('ID de l\'équipe à afficher')
                .setRequired(true)
                .setMinValue(1)),
    
    async execute(interaction) {
        // Répondre immédiatement pour éviter le timeout
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Récupération des informations de l\'équipe...', ephemeral: true });
        }
        
        try {
            const teamId = interaction.options.getInteger('id');
            const apiClient = new ApiClient();
            
            // Effectuer les requêtes vers l'API en parallèle
            const [teamResult, playersResult] = await Promise.all([
                apiClient.getTeam(teamId),
                apiClient.getPlayers(teamId)
            ]);
            
            const responseTime = Math.max(teamResult.responseTime, playersResult.responseTime);
            const teams = teamResult.data;
            const players = playersResult.data;
            
            // Vérifier si l'équipe existe
            if (!Array.isArray(teams) || teams.length === 0) {
                throw new Error(`Aucune équipe trouvée avec l'ID ${teamId}`);
            }
            
            // L'API retourne un tableau, donc on prend le premier élément
            const team = teams[0];
            
            // Vérifier si on a des joueurs (peut être vide mais ne doit pas errorer)
            const playersData = Array.isArray(players) ? players : [];
            let playersError = null;
            
            if (playersData.length === 0) {
                playersError = 'Aucun joueur trouvé pour cette équipe';
            }
            
            // Créer l'embed principal
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`👥 ${team.name || `Équipe ${teamId}`}`)
                .setTimestamp()
                .setFooter({ text: `Récupéré en ${responseTime}ms` });
            
            // Informations de base de l'équipe
            let basicInfo = '';
            if (team.id) basicInfo += `🆔 **ID:** ${team.id}\n`;
            if (team.name) basicInfo += `📛 **Nom:** ${team.name}\n`;
            if (team.captain) basicInfo += `👑 **Capitaine:** ${team.captain}\n`;
            if (team.founded) basicInfo += `📅 **Fondée:** ${team.founded}\n`;
            if (teamData.description) basicInfo += `📝 **Description:** ${teamData.description}\n`;
            
            if (basicInfo) {
                embed.addFields({
                    name: '📋 Informations générales',
                    value: basicInfo,
                    inline: false
                });
            }
            
            // Statistiques de performance
            let statsInfo = '';
            if (team.wins !== undefined) statsInfo += `🏆 **Victoires:** ${team.wins}\n`;
            if (team.losses !== undefined) statsInfo += `💔 **Défaites:** ${team.losses}\n`;
            if (team.points !== undefined) statsInfo += `📊 **Points:** ${team.points}\n`;
            if (team.draws !== undefined) statsInfo += `🤝 **Matchs nuls:** ${team.draws}\n`;
            
            // Calculer le pourcentage de victoires si possible
            if (team.wins !== undefined && team.losses !== undefined) {
                const totalGames = team.wins + team.losses + (team.draws || 0);
                if (totalGames > 0) {
                    const winRate = ((team.wins / totalGames) * 100).toFixed(1);
                    statsInfo += `📈 **Taux de victoire:** ${winRate}%\n`;
                    statsInfo += `🎮 **Total matchs:** ${totalGames}`;
                }
            }
            
            if (statsInfo) {
                embed.addFields({
                    name: '📊 Statistiques',
                    value: statsInfo,
                    inline: false
                });
            }
            
            // Informations de division/saison
            let competitionInfo = '';
            if (team.division) competitionInfo += `🏆 **Division:** ${team.division}\n`;
            if (team.season) competitionInfo += `📅 **Saison:** ${team.season}\n`;
            if (team.rank) competitionInfo += `🏅 **Classement:** ${team.rank}\n`;
            
            if (competitionInfo) {
                embed.addFields({
                    name: '🏁 Compétition',
                    value: competitionInfo,
                    inline: false
                });
            }
            
            // Informations sur les joueurs
            if (playersData && playersData.length > 0) {
                let playersInfo = `👥 **Total:** ${playersData.length} joueur(s)\n\n`;
                
                // Trier les joueurs par nom ou ID
                const sortedPlayers = [...playersData].sort((a, b) => {
                    if (a.name && b.name) return a.name.localeCompare(b.name);
                    return (a.id || 0) - (b.id || 0);
                });
                
                // Afficher les joueurs (limiter à 15 pour éviter de surcharger)
                const playersToShow = sortedPlayers.slice(0, 15);
                
                playersToShow.forEach((player, index) => {
                    let playerLine = `**${index + 1}.** `;
                    
                    if (player.name) {
                        playerLine += `${player.name}`;
                    } else {
                        playerLine += `Joueur ${player.id || 'Inconnu'}`;
                    }
                    
                    if (player.id) {
                        playerLine += ` (ID: ${player.id})`;
                    }
                    
                    // Informations supplémentaires du joueur
                    let playerExtras = [];
                    if (player.position) playerExtras.push(`📍 ${player.position}`);
                    if (player.goals !== undefined) playerExtras.push(`⚽ ${player.goals} buts`);
                    if (player.assists !== undefined) playerExtras.push(`🎯 ${player.assists} passes`);
                    if (player.captain === true) playerExtras.push(`👑 Capitaine`);
                    if (player.joinDate) playerExtras.push(`📅 ${player.joinDate}`);
                    
                    if (playerExtras.length > 0) {
                        playerLine += `\n   ${playerExtras.join(' | ')}`;
                    }
                    
                    playersInfo += playerLine + '\n';
                });
                
                if (playersData.length > 15) {
                    playersInfo += `\n... et ${playersData.length - 15} autres joueurs`;
                }
                
                // Limiter la longueur pour éviter les erreurs Discord
                if (playersInfo.length > 1024) {
                    playersInfo = playersInfo.substring(0, 1020) + '...';
                }
                
                embed.addFields({
                    name: '⚽ Joueurs',
                    value: playersInfo,
                    inline: false
                });
            } else if (playersError) {
                embed.addFields({
                    name: '⚽ Joueurs',
                    value: `⚠️ ${playersError}`,
                    inline: false
                });
            }
            
            // Ajouter une description générale si l'embed semble vide
            if (!embed.data.fields || embed.data.fields.length === 0) {
                embed.setDescription(`Informations sur l'équipe avec l'ID ${teamId}`);
                
                // Afficher toutes les propriétés disponibles de l'équipe
                let allData = '';
                Object.keys(teamData).forEach(key => {
                    if (teamData[key] !== null && teamData[key] !== undefined) {
                        allData += `**${key}:** ${teamData[key]}\n`;
                    }
                });
                
                if (allData) {
                    embed.addFields({
                        name: '📄 Toutes les données disponibles',
                        value: allData.length > 1024 ? allData.substring(0, 1020) + '...' : allData,
                        inline: false
                    });
                }
            }
            
            // Créer les boutons de navigation
            const components = [];
            const navigationRow = new ActionRowBuilder();
            
            // Bouton pour retourner à la liste des équipes
            navigationRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('teams_page_1')
                    .setLabel('Toutes les équipes')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('👥')
            );
            
            // Bouton pour retourner à la liste des saisons
            navigationRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('back_to_seasons')
                    .setLabel('Toutes les saisons')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📅')
            );
            
            // Bouton pour actualiser les informations
            navigationRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`team_details_${teamId}`)
                    .setLabel('🔄 Actualiser')
                    .setStyle(ButtonStyle.Secondary)
            );
            
            components.push(navigationRow);
            
            // Deuxième rangée : Boutons d'actions spécifiques si on a des infos sur la division/saison
            if (teamData.division || teamData.season) {
                const actionsRow = new ActionRowBuilder();
                
                if (teamData.division) {
                    actionsRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`division_details_${teamData.division}`)
                            .setLabel(`Division ${teamData.division}`)
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🏆')
                    );
                }
                
                if (teamData.season) {
                    actionsRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`season_details_${teamData.season}`)
                            .setLabel(`Saison ${teamData.season}`)
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('📅')
                    );
                }
                
                if (actionsRow.components.length > 0) {
                    components.push(actionsRow);
                }
            }
            
            await interaction.editReply({ 
                content: null, 
                embeds: [embed],
                components: components
            });
            
        } catch (error) {
            let errorMessage = 'Erreur inconnue';
            
            if (error instanceof ApiError) {
                if (error.isNotFound()) {
                    errorMessage = `Aucune équipe trouvée avec l'ID ${interaction.options.getInteger('id')}`;
                } else if (error.isTimeout()) {
                    errorMessage = 'Timeout - L\'API ne répond pas dans les temps';
                } else if (error.isServerError()) {
                    errorMessage = 'Erreur interne du serveur API';
                } else {
                    errorMessage = `Erreur API: ${error.status} ${error.message}`;
                }
            } else if (error.name === 'TimeoutError') {
                errorMessage = 'Timeout - L\'API ne répond pas dans les temps';
            } else if (error.code === 'ENOTFOUND') {
                errorMessage = 'Impossible de résoudre le nom de domaine';
            } else if (error.code === 'ECONNREFUSED') {
                errorMessage = 'Connexion refusée par le serveur';
            } else {
                errorMessage = error.message || 'Erreur de connexion à l\'API';
            }
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Erreur - Équipe')
                .addFields(
                    { name: 'Erreur', value: errorMessage, inline: false },
                    { name: 'ID demandé', value: interaction.options.getInteger('id').toString(), inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'Récupération échouée' });
            
            await interaction.editReply({ content: null, embeds: [errorEmbed] });
        }
    },
};
