const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { authenticatedFetch } = require('../utils/authenticatedApi');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('equipe-membres')
        .setDescription('Affiche les membres d\'une équipe')
        .addIntegerOption(option =>
            option.setName('equipe')
                .setDescription('ID de l\'équipe')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const teamId = interaction.options.getInteger('equipe');

            const result = await authenticatedFetch(`/teams/${teamId}/members`, {
                method: 'GET'
            }, interaction.user.id);

            if (result.error) {
                return await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('❌ Erreur - Membres de l\'équipe')
                        .setDescription(result.error)
                        .setTimestamp()]
                });
            }

            const data = result.data;

            if (!data.members || data.members.length === 0) {
                return await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor(0xFFA500)
                        .setTitle(`👥 ${data.team.name}`)
                        .setDescription('Aucun membre dans cette équipe.')
                        .setTimestamp()]
                });
            }

            const membersList = data.members.map(m => {
                const roleIcon = m.role === 'captain' ? '👑' : '👤';
                const mention = m.discord_id ? `<@${m.discord_id}>` : m.discord_username;
                const joinDate = new Date(m.joined_at).toLocaleDateString('fr-FR');
                return `${roleIcon} ${mention} · Depuis le ${joinDate}`;
            }).join('\n');

            const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setTitle(`👥 ${data.team.name}`)
                .setDescription(membersList)
                .setFooter({ text: `${data.members.length} membre(s) · ID: ${data.team.id}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur lors de la récupération des membres:', error);
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Erreur - Membres de l\'équipe')
                    .setDescription(error.name === 'TimeoutError'
                        ? 'Timeout - L\'API ne répond pas'
                        : 'Erreur de connexion à l\'API')
                    .setTimestamp()]
            });
        }
    },
};
