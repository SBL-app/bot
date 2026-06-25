const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { API_URL, fetchAPI } = require('../apiConfig');

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
        // Répondre immédiatement pour éviter le timeout
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Récupération des saisons...', ephemeral: true });
        }

        const startTime = Date.now();
        const { data: seasons, error } = await fetchAPI('/seasons');
        const responseTime = Date.now() - startTime;

        // Gestion des erreurs API
        if (error) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Erreur - Saisons')
                .setDescription(error)
                .addFields({ name: 'URL tentée', value: `${API_URL}/seasons`, inline: false })
                .setTimestamp()
                .setFooter({ text: 'Récupération échouée' });

            await interaction.editReply({ content: null, embeds: [errorEmbed] });
            return;
        }

        // Cas où aucune saison n'existe
        if (!seasons || !Array.isArray(seasons) || seasons.length === 0) {
            const emptyEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('📅 Saisons SBL')
                .setDescription('Aucune saison n\'a encore été créée.')
                .addFields({
                    name: 'Information',
                    value: 'Les saisons seront affichées ici une fois créées par les administrateurs.',
                    inline: false
                })
                .setTimestamp()
                .setFooter({ text: `Récupéré en ${responseTime}ms` });

            await interaction.editReply({ content: null, embeds: [emptyEmbed], components: [] });
            return;
        }

        // Pagination
        const pageParam = interaction.options.getInteger('page') || 1;
        const seasonsPerPage = 5;
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

        // Ajouter chaque saison
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

            seasonInfo += `💡 **Détails:** \`/saison id:${season.id}\``;

            embed.addFields({
                name: `${season.id}. ${season.name || `Saison ${season.id}`}`,
                value: seasonInfo || 'Aucune information disponible',
                inline: false
            });
        });

        // Boutons de navigation
        const components = [];

        if (totalPages > 1) {
            const row = new ActionRowBuilder();

            if (currentPage > 1) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`seasons_page_${currentPage - 1}`)
                        .setLabel('⬅️ Précédent')
                        .setStyle(ButtonStyle.Primary)
                );
            }

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('seasons_page_info')
                    .setLabel(`Page ${currentPage}/${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );

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

        // Boutons détails des saisons
        if (seasonsToShow.length > 0) {
            const detailsRow = new ActionRowBuilder();

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
    },
};

function generateProgressBar(percentage, length = 10) {
    const filled = Math.round((percentage / 100) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}
