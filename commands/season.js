const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ApiClient, ApiError } = require('../utils/apiClient');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('saison')
        .setDescription('Affiche les détails d\'une saison spécifique')
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('ID de la saison à afficher')
                .setRequired(true)
                .setMinValue(1)),
    
    async execute(interaction) {
        // Répondre immédiatement pour éviter le timeout seulement si ce n'est pas déjà fait
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Récupération des détails de la saison...', ephemeral: true });
        }
        
        try {
            const seasonId = interaction.options.getInteger('id');
            const apiClient = new ApiClient();
            const result = await apiClient.getSeason(seasonId);
            const season = result.data;
            const responseTime = result.responseTime;
            
            // L'API retourne maintenant un objet unique
            if (!season || !season.id) {
                throw new Error(`Saison avec l'ID ${seasonId} non trouvée`);
            }
            
            // Créer l'embed avec les détails de la saison
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`📅 ${season.name || `Saison ${season.id}`}`)
                .setDescription(`Détails de la saison ID: **${season.id}**`)
                .setTimestamp()
                .setFooter({ text: `Récupéré en ${responseTime}ms` });
            
            // Ajouter les informations de la saison
            let seasonDetails = '';
            
            if (season.start_date && season.end_date) {
                seasonDetails += `📅 **Période:** ${season.start_date} → ${season.end_date}\n`;
                
                // Calculer la durée
                try {
                    const startDate = parseDate(season.start_date);
                    const endDate = parseDate(season.end_date);
                    const duration = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
                    seasonDetails += `⏱️ **Durée:** ${duration} jours\n`;
                } catch (dateError) {
                    // Ignore les erreurs de parsing de date
                }
            }
            
            if (season.total_games !== undefined) {
                seasonDetails += `🎮 **Matchs:** ${season.finished_games || 0}/${season.total_games} terminés\n`;
                
                if (season.percentage !== undefined) {
                    const percentage = parseFloat(season.percentage);
                    const progressBar = generateProgressBar(percentage);
                    seasonDetails += `📊 **Progression:** ${progressBar} ${season.percentage}%\n`;
                }
            }
            
            // Ajouter le statut de la saison
            const currentDate = new Date();
            let status = '❓ Statut inconnu';
            
            if (season.start_date && season.end_date) {
                try {
                    const startDate = parseDate(season.start_date);
                    const endDate = parseDate(season.end_date);
                    
                    if (currentDate < startDate) {
                        status = '⏳ À venir';
                    } else if (currentDate > endDate) {
                        status = '✅ Terminée';
                    } else {
                        status = '🔴 En cours';
                    }
                } catch (dateError) {
                    // Garde le statut par défaut
                }
            }
            
            seasonDetails += `🔸 **Statut:** ${status}`;
            
            if (!seasonDetails) {
                seasonDetails = 'Aucune information détaillée disponible';
            }
            
            embed.addFields({
                name: 'Informations',
                value: seasonDetails,
                inline: false
            });
            
            // Créer les boutons de navigation
            const components = [];
            const actionRow = new ActionRowBuilder();
            
            // Bouton pour voir les divisions de cette saison
            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`divisions_season_${season.id}`)
                    .setLabel('Voir les divisions')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🏆')
            );
            
            // Bouton pour retourner à la liste des saisons
            actionRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('back_to_seasons')
                    .setLabel('Retour aux saisons')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📅')
            );
            
            components.push(actionRow);
            
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
                .setTitle('❌ Erreur - Détails de la saison')
                .addFields(
                    { name: 'Erreur', value: errorMessage, inline: false },
                    { name: 'ID recherché', value: `${interaction.options.getInteger('id')}`, inline: false }
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

// Fonction utilitaire pour parser les dates au format DD-MM-YYYY
function parseDate(dateString) {
    const [day, month, year] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day); // month - 1 car les mois sont indexés à partir de 0
}
