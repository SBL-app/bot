const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { API_URL, fetchAPI } = require('../apiConfig');

const MAX_MATCHES = 10;

/**
 * Formate une date ISO en date/heure française lisible.
 * @param {string} dateString
 * @returns {string}
 */
function formatDate(dateString) {
    try {
        return new Date(dateString).toLocaleDateString('fr-FR', {
            weekday: 'short',
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    } catch {
        return dateString;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('schedule')
        .setDescription('Affiche le planning des prochains matchs d\'une division')
        .addIntegerOption(option =>
            option.setName('division')
                .setDescription('ID de la division dont afficher le planning')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Récupération du planning...', ephemeral: true });
        }

        const divisionId = interaction.options.getInteger('division');
        const startTime = Date.now();

        const { data: games, error } = await fetchAPI(`/games/${divisionId}`);
        const responseTime = Date.now() - startTime;

        if (error) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Erreur - Planning')
                .addFields(
                    { name: 'Erreur', value: error, inline: false },
                    { name: 'URL tentée', value: `${API_URL}/games/${divisionId}`, inline: false },
                )
                .setTimestamp()
                .setFooter({ text: 'Récupération échouée' });
            await interaction.editReply({ content: null, embeds: [errorEmbed] });
            return;
        }

        // Ne garder que les matchs non joués, triés par date croissante.
        const upcoming = (Array.isArray(games) ? games : [])
            .filter(game => game.status !== 'joué')
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        if (upcoming.length === 0) {
            const emptyEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle(`📅 Planning - Division ${divisionId}`)
                .setDescription('Aucun match à venir pour cette division')
                .setTimestamp()
                .setFooter({ text: `Récupéré en ${responseTime}ms` });
            await interaction.editReply({ content: null, embeds: [emptyEmbed] });
            return;
        }

        const shown = upcoming.slice(0, MAX_MATCHES);

        // Regrouper par semaine pour la lisibilité.
        const byWeek = {};
        shown.forEach(game => {
            const week = game.week ?? '?';
            (byWeek[week] ||= []).push(game);
        });

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`📅 Planning - ${shown[0].division || `Division ${divisionId}`}`)
            .setDescription(`**${upcoming.length}** match(s) à venir` +
                (upcoming.length > MAX_MATCHES ? ` — affichage des **${MAX_MATCHES}** prochains` : ''))
            .setTimestamp()
            .setFooter({ text: `Récupéré en ${responseTime}ms` });

        Object.keys(byWeek)
            .sort((a, b) => parseInt(a) - parseInt(b))
            .forEach(week => {
                let content = '';
                byWeek[week].forEach(game => {
                    content += `⚽ **${game.team1}** vs **${game.team2}**\n`;
                    content += `📅 ${formatDate(game.date)} · match #${game.id}\n\n`;
                });
                if (content.length > 1024) content = content.substring(0, 1021) + '...';
                embed.addFields({ name: `Semaine ${week}`, value: content || 'Aucun match', inline: false });
            });

        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`matchs_division_${divisionId}_page_1`)
                .setLabel('Tous les matchs')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⚽'),
            new ButtonBuilder()
                .setCustomId(`division_details_${divisionId}`)
                .setLabel('Détails de la division')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🏆'),
        );

        await interaction.editReply({ content: null, embeds: [embed], components: [actionRow] });
    },
};
