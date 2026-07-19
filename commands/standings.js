const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { API_URL, fetchAPI } = require('../apiConfig');

/**
 * Trie les statistiques d'équipes selon le barème de la ligue :
 * points décroissants, puis différence de rounds, puis victoires.
 * @param {object[]} stats - statistiques renvoyées par l'API
 * @returns {object[]} copie triée
 */
function sortStandings(stats) {
    return [...stats].sort((a, b) => {
        if ((b.points || 0) !== (a.points || 0)) return (b.points || 0) - (a.points || 0);
        const diffA = (a.winRounds || 0) - (a.looseRounds || 0);
        const diffB = (b.winRounds || 0) - (b.looseRounds || 0);
        if (diffB !== diffA) return diffB - diffA;
        return (b.wins || 0) - (a.wins || 0);
    });
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('standings')
        .setDescription('Affiche le classement actuel d\'une division')
        .addIntegerOption(option =>
            option.setName('division')
                .setDescription('ID de la division dont afficher le classement')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Récupération du classement...', ephemeral: true });
        }

        const divisionId = interaction.options.getInteger('division');
        const startTime = Date.now();

        const { data: stats, error } = await fetchAPI(`/teamStats/division/${divisionId}`);
        const responseTime = Date.now() - startTime;

        if (error) {
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Erreur - Classement')
                .addFields(
                    { name: 'Erreur', value: error, inline: false },
                    { name: 'URL tentée', value: `${API_URL}/teamStats/division/${divisionId}`, inline: false },
                )
                .setTimestamp()
                .setFooter({ text: 'Récupération échouée' });
            await interaction.editReply({ content: null, embeds: [errorEmbed] });
            return;
        }

        if (!Array.isArray(stats) || stats.length === 0) {
            const emptyEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle(`🏆 Classement - Division ${divisionId}`)
                .setDescription('Aucune statistique trouvée pour cette division')
                .setTimestamp()
                .setFooter({ text: `Récupéré en ${responseTime}ms` });
            await interaction.editReply({ content: null, embeds: [emptyEmbed] });
            return;
        }

        const sorted = sortStandings(stats);

        let table = '';
        sorted.forEach((team, index) => {
            const position = index + 1;
            const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `**${position}.**`;
            const diff = (team.winRounds || 0) - (team.looseRounds || 0);
            const diffStr = diff >= 0 ? `+${diff}` : `${diff}`;
            table += `${medal} **${team.team_name || `Équipe ${team.team_id}`}** — **${team.points || 0}** pts\n`;
            table += `   └ ${team.wins || 0}V · ${team.ties || 0}N · ${team.losses || 0}D · rounds ${team.winRounds || 0}/${team.looseRounds || 0} (${diffStr})\n`;

            // Découpe en plusieurs champs si on approche de la limite Discord (1024 car.)
            if (table.length > 950) {
                table += '…\n';
            }
        });

        if (table.length > 1024) {
            table = table.substring(0, 1021) + '...';
        }

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`🏆 Classement - Division ${divisionId}`)
            .setDescription(`**${sorted.length}** équipe(s) classée(s)`)
            .addFields({ name: 'Classement', value: table || 'Aucune donnée', inline: false })
            .setTimestamp()
            .setFooter({ text: `Récupéré en ${responseTime}ms` });

        const actionRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`division_details_${divisionId}`)
                .setLabel('Détails de la division')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🏆'),
            new ButtonBuilder()
                .setCustomId(`matchs_division_${divisionId}_page_1`)
                .setLabel('Voir les matchs')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('⚽'),
        );

        await interaction.editReply({ content: null, embeds: [embed], components: [actionRow] });
    },
};
