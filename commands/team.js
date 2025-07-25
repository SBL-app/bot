const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config.json');

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
            const startTime = Date.now();
            
            // Effectuer les requêtes vers l'API en parallèle
            const [teamResponse, playersResponse] = await Promise.all([
                fetch(`${config.apiUrl}/team/${teamId}`, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'SBL-Discord-Bot',
                        'Accept': 'application/json'
                    },
                    signal: AbortSignal.timeout(15000)
                }),
                fetch(`${config.apiUrl}/players/${teamId}`, {
                    method: 'GET',
                    headers: {
                        'User-Agent': 'SBL-Discord-Bot',
                        'Accept': 'application/json'
                    },
                    signal: AbortSignal.timeout(15000)
                })
            ]);
            
            const responseTime = Date.now() - startTime;
            
            // Vérifier la réponse de l'équipe
            if (!teamResponse.ok) {
                if (teamResponse.status === 404) {
                    throw new Error(`Aucune équipe trouvée avec l'ID ${teamId}`);
                }
                throw new Error(`Erreur API équipe: ${teamResponse.status} ${teamResponse.statusText}`);
            }
            
            const teamData = await teamResponse.json();
            
            // Vérifier la réponse des joueurs (non critique si elle échoue)
            let playersData = [];
            let playersError = null;
            
            if (playersResponse.ok) {
                try {
                    playersData = await playersResponse.json();
                    if (!Array.isArray(playersData)) {
                        playersData = [];
                        playersError = 'Format de données des joueurs non reconnu';
                    }
                } catch (error) {
                    playersError = 'Impossible de parser les données des joueurs';
                }
            } else if (playersResponse.status === 404) {
                playersError = 'Aucun joueur trouvé pour cette équipe';
            } else {
                playersError = `Erreur API joueurs: ${playersResponse.status}`;
            }
            
            // Créer l'embed principal
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`👥 ${teamData.name || `Équipe ${teamId}`}`)
                .setTimestamp()
                .setFooter({ text: `Récupéré en ${responseTime}ms` });
            
            // Informations de base de l'équipe
            let basicInfo = '';
            if (teamData.id) basicInfo += `🆔 **ID:** ${teamData.id}\n`;
            if (teamData.name) basicInfo += `📛 **Nom:** ${teamData.name}\n`;
            if (teamData.captain) basicInfo += `👑 **Capitaine:** ${teamData.captain}\n`;
            if (teamData.founded) basicInfo += `📅 **Fondée:** ${teamData.founded}\n`;
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
            if (teamData.wins !== undefined) statsInfo += `🏆 **Victoires:** ${teamData.wins}\n`;
            if (teamData.losses !== undefined) statsInfo += `💔 **Défaites:** ${teamData.losses}\n`;
            if (teamData.points !== undefined) statsInfo += `📊 **Points:** ${teamData.points}\n`;
            if (teamData.draws !== undefined) statsInfo += `🤝 **Matchs nuls:** ${teamData.draws}\n`;
            
            // Calculer le pourcentage de victoires si possible
            if (teamData.wins !== undefined && teamData.losses !== undefined) {
                const totalGames = teamData.wins + teamData.losses + (teamData.draws || 0);
                if (totalGames > 0) {
                    const winRate = ((teamData.wins / totalGames) * 100).toFixed(1);
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
            if (teamData.division) competitionInfo += `🏆 **Division:** ${teamData.division}\n`;
            if (teamData.season) competitionInfo += `📅 **Saison:** ${teamData.season}\n`;
            if (teamData.rank) competitionInfo += `🏅 **Classement:** ${teamData.rank}\n`;
            
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
            
            if (error.name === 'TimeoutError') {
                errorMessage = 'Timeout - L\'API ne répond pas dans les temps';
            } else if (error.code === 'ENOTFOUND') {
                errorMessage = 'Impossible de résoudre le nom de domaine';
            } else if (error.code === 'ECONNREFUSED') {
                errorMessage = 'Connexion refusée par le serveur';
            } else if (error.message.includes('404') || error.message.includes('Aucune équipe')) {
                errorMessage = error.message;
            } else if (error.message.includes('500')) {
                errorMessage = 'Erreur interne du serveur API';
            } else {
                errorMessage = error.message || 'Erreur de connexion à l\'API';
            }
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Erreur - Équipe')
                .addFields(
                    { name: 'Erreur', value: errorMessage, inline: false },
                    { name: 'ID demandé', value: interaction.options.getInteger('id').toString(), inline: false },
                    { name: 'URLs tentées', value: `${config.apiUrl}/team/${interaction.options.getInteger('id')}\n${config.apiUrl}/players/${interaction.options.getInteger('id')}`, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'Récupération échouée' });
            
            await interaction.editReply({ content: null, embeds: [errorEmbed] });
        }
    },
};
