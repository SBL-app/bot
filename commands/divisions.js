const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('divisions')
        .setDescription('Affiche les divisions d\'une saison spécifique')
        .addIntegerOption(option =>
            option.setName('saison')
                .setDescription('ID de la saison pour laquelle récupérer les divisions')
                .setRequired(true)
                .setMinValue(1)),
    
    async execute(interaction) {
        // Répondre immédiatement pour éviter le timeout seulement si ce n'est pas déjà fait
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Récupération des divisions...', ephemeral: true });
        }
        
        try {
            const seasonId = interaction.options.getInteger('saison');
            const apiUrl = `${config.apiUrl}/division/season/${seasonId}`;
            const startTime = Date.now();
            
            // Effectuer la requête vers l'API
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'SBL-Discord-Bot',
                    'Accept': 'application/json'
                },
                // Timeout de 15 secondes
                signal: AbortSignal.timeout(15000)
            });
            
            const responseTime = Date.now() - startTime;
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Aucune division trouvée pour la saison ${seasonId}`);
                }
                throw new Error(`Erreur API: ${response.status} ${response.statusText}`);
            }
            
            const divisions = await response.json();
            
            if (!Array.isArray(divisions)) {
                throw new Error('Format de données non reconnu de l\'API');
            }
            
            if (divisions.length === 0) {
                const emptyEmbed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle(`🏆 Divisions - Saison ${seasonId}`)
                    .setDescription('Aucune division trouvée pour cette saison')
                    .setTimestamp()
                    .setFooter({ text: `Récupéré en ${responseTime}ms` });
                
                await interaction.editReply({ content: null, embeds: [emptyEmbed] });
                return;
            }
            
            // Créer les boutons de navigation
            const createNavigationButtons = (seasonId, divisions) => {
                const components = [];
                
                // Première rangée : Navigation principale
                const navigationRow = new ActionRowBuilder();
                
                // Bouton pour retourner aux détails de la saison
                navigationRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`season_details_${seasonId}`)
                        .setLabel('Détails de la saison')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📅')
                );
                
                // Bouton pour retourner à la liste des saisons
                navigationRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId('back_to_seasons')
                        .setLabel('Toutes les saisons')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('📋')
                );
                
                components.push(navigationRow);
                
                // Deuxième rangée : Boutons vers les divisions (max 5 boutons par rangée)
                if (divisions && divisions.length > 0) {
                    const divisionsToShow = divisions.slice(0, 5); // Limiter à 5 divisions pour la première rangée
                    const divisionRow = new ActionRowBuilder();
                    
                    divisionsToShow.forEach(division => {
                        divisionRow.addComponents(
                            new ButtonBuilder()
                                .setCustomId(`division_details_${division.id}`)
                                .setLabel(`${division.name || `Div ${division.id}`}`)
                                .setStyle(ButtonStyle.Primary)
                                .setEmoji('🏆')
                        );
                    });
                    
                    components.push(divisionRow);
                    
                    // Troisième rangée : Si plus de 5 divisions
                    if (divisions.length > 5) {
                        const remainingDivisions = divisions.slice(5, 10); // 5 divisions supplémentaires
                        const additionalDivisionRow = new ActionRowBuilder();
                        
                        remainingDivisions.forEach(division => {
                            additionalDivisionRow.addComponents(
                                new ButtonBuilder()
                                    .setCustomId(`division_details_${division.id}`)
                                    .setLabel(`${division.name || `Div ${division.id}`}`)
                                    .setStyle(ButtonStyle.Primary)
                                    .setEmoji('🏆')
                            );
                        });
                        
                        components.push(additionalDivisionRow);
                    }
                }
                
                return components;
            };
            
            // Créer l'embed principal
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`🏆 Divisions - Saison ${seasonId}`)
                .setDescription(`**${divisions.length}** division(s) trouvée(s)`)
                .setTimestamp()
                .setFooter({ text: `Récupéré en ${responseTime}ms` });
            
            // Ajouter chaque division
            divisions.forEach(division => {
                let divisionInfo = '';
                
                // Informations de base de la division
                divisionInfo += `🆔 **ID:** ${division.id}\n`;
                divisionInfo += `📅 **Saison:** ${division.season}\n`;
                
                // Informations sur les équipes
                if (division.teams && Array.isArray(division.teams)) {
                    divisionInfo += `👥 **Nombre d'équipes:** ${division.teams.length}\n`;
                    
                    if (division.teams.length === 0) {
                        divisionInfo += `📋 **Équipes:** Aucune équipe inscrite`;
                    } else {
                        divisionInfo += `📋 **Classement:**\n`;
                        
                        // Trier les équipes par points (décroissant), puis par victoires, puis par défaites
                        const sortedTeams = [...division.teams].sort((a, b) => {
                            if (b.points !== a.points) return b.points - a.points;
                            if (b.wins !== a.wins) return b.wins - a.wins;
                            return a.losses - b.losses;
                        });
                        
                        // Afficher les équipes (limiter à 10 pour éviter de surcharger)
                        const teamsToShow = sortedTeams.slice(0, 10);
                        teamsToShow.forEach((team, index) => {
                            const position = index + 1;
                            const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
                            
                            divisionInfo += `${medal} **${team.name}** (ID: ${team.id})`;
                            divisionInfo += ` - ${team.wins}V/${team.losses}D - ${team.points} pts\n`;
                        });
                        
                        if (division.teams.length > 10) {
                            divisionInfo += `... et ${division.teams.length - 10} autres équipes`;
                        }
                    }
                } else {
                    divisionInfo += `👥 **Équipes:** Information non disponible`;
                }
                
                // Ajouter un lien vers les détails de la division
                divisionInfo += `\n💡 **Détails:** Utilisez le bouton ci-dessous ou \`/division id:${division.id}\``;
                
                // Limiter la longueur du champ pour éviter les erreurs Discord
                if (divisionInfo.length > 1024) {
                    divisionInfo = divisionInfo.substring(0, 1021) + '...';
                }
                
                embed.addFields({
                    name: `${division.name || `Division ${division.id}`}`,
                    value: divisionInfo,
                    inline: false
                });
            });
            
            // Si l'embed devient trop grand, diviser en plusieurs messages
            if (embed.data.fields && embed.data.fields.length > 6) {
                // Pour les grandes listes, créer un embed simplifié
                const simplifiedEmbed = new EmbedBuilder()
                    .setColor(0x0099FF)
                    .setTitle(`🏆 Divisions - Saison ${seasonId}`)
                    .setDescription(`**${divisions.length}** division(s) trouvée(s)`)
                    .setTimestamp()
                    .setFooter({ text: `Récupéré en ${responseTime}ms` });
                
                let summaryText = '';
                divisions.forEach(division => {
                    const teamCount = division.teams ? division.teams.length : 0;
                    summaryText += `**${division.name || `Division ${division.id}`}** (ID: ${division.id}) - ${teamCount} équipe(s)\n`;
                });
                
                simplifiedEmbed.addFields({
                    name: 'Liste des divisions',
                    value: summaryText || 'Aucune information disponible',
                    inline: false
                });
                
                if (divisions.some(d => d.teams && d.teams.length > 0)) {
                    simplifiedEmbed.addFields({
                        name: 'ℹ️ Information',
                        value: 'Utilisez les boutons ci-dessous ou `/division id:<id>` pour voir les détails d\'une division spécifique',
                        inline: false
                    });
                } else {
                    simplifiedEmbed.addFields({
                        name: 'ℹ️ Information',
                        value: 'Utilisez les boutons ci-dessous pour naviguer vers une division spécifique',
                        inline: false
                    });
                }
                
                await interaction.editReply({ 
                    content: null, 
                    embeds: [simplifiedEmbed],
                    components: createNavigationButtons(seasonId, divisions)
                });
            } else {
                await interaction.editReply({ 
                    content: null, 
                    embeds: [embed],
                    components: createNavigationButtons(seasonId, divisions)
                });
            }
            
        } catch (error) {
            let errorMessage = 'Erreur inconnue';
            
            if (error.name === 'TimeoutError') {
                errorMessage = 'Timeout - L\'API ne répond pas dans les temps';
            } else if (error.code === 'ENOTFOUND') {
                errorMessage = 'Impossible de résoudre le nom de domaine';
            } else if (error.code === 'ECONNREFUSED') {
                errorMessage = 'Connexion refusée par le serveur';
            } else if (error.message.includes('404') || error.message.includes('Aucune division')) {
                errorMessage = error.message;
            } else if (error.message.includes('500')) {
                errorMessage = 'Erreur interne du serveur API';
            } else {
                errorMessage = error.message || 'Erreur de connexion à l\'API';
            }
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Erreur - Divisions')
                .addFields(
                    { name: 'Erreur', value: errorMessage, inline: false },
                    { name: 'URL tentée', value: `${config.apiUrl}/division/season/${interaction.options.getInteger('saison')}`, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'Récupération échouée' });
            
            await interaction.editReply({ content: null, embeds: [errorEmbed] });
        }
    },
};
