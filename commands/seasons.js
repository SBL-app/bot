const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('saisons')
        .setDescription('Affiche la liste des saisons SBL')
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Numéro de page à afficher (optionnel)')
                .setRequired(false)
                .setMinValue(1)),
    
    async execute(interaction) {
        // Répondre immédiatement pour éviter le timeout seulement si ce n'est pas déjà fait
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Récupération des saisons...', ephemeral: true });
        }
        
        try {
            const pageParam = interaction.options.getInteger('page') || 1;
            const seasonsPerPage = 5; // Nombre de saisons par page
            
            const apiUrl = `${config.apiUrl}/seasons`;
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
                throw new Error(`Erreur API: ${response.status} ${response.statusText}`);
            }
            
            const seasons = await response.json();
            
            if (!Array.isArray(seasons)) {
                throw new Error('Format de données non reconnu de l\'API');
            }
            
            if (seasons.length === 0) {
                const emptyEmbed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('📅 Saisons SBL')
                    .setDescription('Aucune saison trouvée dans l\'API')
                    .setTimestamp()
                    .setFooter({ text: `Récupéré en ${responseTime}ms` });
                
                await interaction.editReply({ content: null, embeds: [emptyEmbed] });
                return;
            }
            
            // Calculer la pagination
            const totalPages = Math.ceil(seasons.length / seasonsPerPage);
            const currentPage = Math.min(pageParam, totalPages);
            const startIndex = (currentPage - 1) * seasonsPerPage;
            const endIndex = Math.min(startIndex + seasonsPerPage, seasons.length);
            const seasonsToShow = seasons.slice(startIndex, endIndex);
            
            // Créer l'embed principal
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('📅 Saisons SBL')
                .setDescription(`**${seasons.length}** saison(s) trouvée(s) | Page **${currentPage}**/**${totalPages}**`)
                .setTimestamp()
                .setFooter({ text: `Récupéré en ${responseTime}ms` });
            
            // Ajouter chaque saison de la page actuelle
            seasonsToShow.forEach(season => {
                let seasonInfo = '';
                
                if (season.start_date && season.end_date) {
                    seasonInfo += `📅 **Période:** ${season.start_date} → ${season.end_date}\n`;
                }
                
                if (season.total_games !== undefined) {
                    seasonInfo += `🎮 **Matchs:** ${season.finished_games || 0}/${season.total_games} terminés\n`;
                }
                
                if (season.percentage !== undefined) {
                    const percentage = parseFloat(season.percentage);
                    const progressBar = generateProgressBar(percentage);
                    seasonInfo += `📊 **Progression:** ${progressBar} ${season.percentage}%\n`;
                }
                
                // Ajouter le lien vers les détails
                seasonInfo += `💡 **Détails:** Utilisez \`/saison id:${season.id}\` pour plus d'infos`;
                
                if (!seasonInfo) {
                    seasonInfo = 'Aucune information disponible';
                }
                
                embed.addFields({
                    name: `${season.id}. ${season.name || `Saison ${season.id}`}`,
                    value: seasonInfo,
                    inline: false
                });
            });
            
            // Créer les boutons de navigation si nécessaire
            const components = [];
            if (totalPages > 1) {
                const row = new ActionRowBuilder();
                
                // Bouton page précédente
                if (currentPage > 1) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`seasons_page_${currentPage - 1}`)
                            .setLabel('⬅️ Précédent')
                            .setStyle(ButtonStyle.Primary)
                    );
                }
                
                // Bouton informations de page
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('seasons_page_info')
                        .setLabel(`Page ${currentPage}/${totalPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );
                
                // Bouton page suivante
                if (currentPage < totalPages) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`seasons_page_${currentPage + 1}`)
                            .setLabel('Suivant ➡️')
                            .setStyle(ButtonStyle.Primary)
                    );
                }
                
                components.push(row);
            }
            
            // Ajouter une deuxième rangée avec des boutons pour accéder aux détails des saisons
            if (seasonsToShow.length > 0) {
                const detailsRow = new ActionRowBuilder();
                
                // Ajouter jusqu'à 5 boutons pour les saisons affichées
                seasonsToShow.slice(0, 5).forEach(season => {
                    detailsRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`season_details_${season.id}`)
                            .setLabel(`Saison ${season.id}`)
                            .setStyle(ButtonStyle.Secondary)
                            .setEmoji('🔍')
                    );
                });
                
                components.push(detailsRow);
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
            } else if (error.message.includes('404')) {
                errorMessage = 'Route /seasons non trouvée sur l\'API';
            } else if (error.message.includes('500')) {
                errorMessage = 'Erreur interne du serveur API';
            } else {
                errorMessage = error.message || 'Erreur de connexion à l\'API';
            }
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Erreur - Saisons')
                .addFields(
                    { name: 'Erreur', value: errorMessage, inline: false },
                    { name: 'URL tentée', value: `${config.apiUrl}/seasons`, inline: false }
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
