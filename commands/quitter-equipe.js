const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { authenticatedFetch } = require('../utils/authenticatedApi');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quitter-equipe')
        .setDescription('Quitter une équipe')
        .addIntegerOption(option =>
            option.setName('equipe')
                .setDescription('ID de l\'équipe à quitter')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const teamId = interaction.options.getInteger('equipe');

            const result = await authenticatedFetch(`/teams/${teamId}/members`, {
                method: 'DELETE',
                body: JSON.stringify({ discord_id: interaction.user.id })
            }, interaction.user.id);

            if (result.error) {
                let errorMessage = result.error;

                if (!result.authError) {
                    if (errorMessage.includes('last captain') || errorMessage.includes('dernier capitaine') || errorMessage.includes('Promote another')) {
                        errorMessage = 'Vous êtes le dernier capitaine de cette équipe. Promouvez un autre membre avec `/changer-role` avant de quitter.';
                    }
                }

                return await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('❌ Erreur - Quitter l\'équipe')
                        .setDescription(errorMessage)
                        .setTimestamp()]
                });
            }

            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('👋 Vous avez quitté l\'équipe')
                .setDescription(`Vous avez quitté l'équipe ID: ${teamId}.`)
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur lors du départ de l\'équipe:', error);
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Erreur - Quitter l\'équipe')
                    .setDescription(error.name === 'TimeoutError'
                        ? 'Timeout - L\'API ne répond pas'
                        : 'Erreur de connexion à l\'API')
                    .setTimestamp()]
            });
        }
    },
};
