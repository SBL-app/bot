const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { authenticatedFetch } = require('../utils/authenticatedApi');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ajouter-membre')
        .setDescription('Ajoute un membre à votre équipe (capitaine uniquement)')
        .addIntegerOption(option =>
            option.setName('equipe')
                .setDescription('ID de l\'équipe')
                .setRequired(true)
                .setMinValue(1))
        .addUserOption(option =>
            option.setName('joueur')
                .setDescription('Joueur à ajouter')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const teamId = interaction.options.getInteger('equipe');
            const player = interaction.options.getUser('joueur');

            const result = await authenticatedFetch(`/teams/${teamId}/members`, {
                method: 'POST',
                body: JSON.stringify({ discord_id: player.id })
            }, interaction.user.id);

            if (result.error) {
                let errorMessage = result.error;

                if (!result.authError) {
                    if (result.status === 403) {
                        errorMessage = 'Vous devez être capitaine de l\'équipe pour ajouter des membres.';
                    } else if (result.status === 404) {
                        errorMessage = `<@${player.id}> n'a pas de compte lié. Il doit d'abord se connecter sur le site web avec Discord.`;
                    } else if (result.status === 409) {
                        errorMessage = `<@${player.id}> est déjà membre de cette équipe.`;
                    }
                }

                return await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('❌ Erreur - Ajout de membre')
                        .setDescription(errorMessage)
                        .setTimestamp()]
                });
            }

            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Membre ajouté avec succès!')
                .addFields(
                    { name: '👤 Joueur', value: `<@${player.id}>`, inline: true },
                    { name: '🏷️ Équipe', value: `ID: ${teamId}`, inline: true },
                    { name: '🎭 Rôle', value: 'Membre', inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur lors de l\'ajout de membre:', error);
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Erreur - Ajout de membre')
                    .setDescription(error.name === 'TimeoutError'
                        ? 'Timeout - L\'API ne répond pas'
                        : 'Erreur de connexion à l\'API')
                    .setTimestamp()]
            });
        }
    },
};
