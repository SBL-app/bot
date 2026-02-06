const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { authenticatedFetch } = require('../utils/authenticatedApi');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('creer-equipe')
        .setDescription('Crée une nouvelle équipe (vous devenez capitaine)')
        .addStringOption(option =>
            option.setName('nom')
                .setDescription('Nom de l\'équipe')
                .setRequired(true)
                .setMinLength(2)
                .setMaxLength(50)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const teamName = interaction.options.getString('nom');

            const result = await authenticatedFetch('/teams/create-with-captain', {
                method: 'POST',
                body: JSON.stringify({ name: teamName })
            }, interaction.user.id);

            if (result.error) {
                return await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('❌ Erreur - Création d\'équipe')
                        .setDescription(result.authError
                            ? result.error
                            : result.error)
                        .setTimestamp()]
                });
            }

            const data = result.data;

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Équipe créée avec succès!')
                .addFields(
                    { name: '🏷️ Nom', value: data.team.name, inline: true },
                    { name: '🆔 ID', value: `${data.team.id}`, inline: true },
                    { name: '👑 Capitaine', value: `<@${interaction.user.id}>`, inline: true }
                )
                .setFooter({ text: 'Utilisez /ajouter-membre pour ajouter des joueurs' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur lors de la création d\'équipe:', error);
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Erreur - Création d\'équipe')
                    .setDescription(error.name === 'TimeoutError'
                        ? 'Timeout - L\'API ne répond pas'
                        : 'Erreur de connexion à l\'API')
                    .setTimestamp()]
            });
        }
    },
};
