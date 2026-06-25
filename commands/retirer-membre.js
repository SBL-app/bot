import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { authenticatedFetch } from '../utils/authenticatedApi.js';

export const data = new SlashCommandBuilder()
    .setName('retirer-membre')
    .setDescription('Retire un membre de votre équipe (capitaine uniquement)')
    .addIntegerOption(option =>
        option.setName('equipe')
            .setDescription('ID de l\'équipe')
            .setRequired(true)
            .setMinValue(1))
    .addUserOption(option =>
        option.setName('joueur')
            .setDescription('Joueur à retirer')
            .setRequired(true));

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const teamId = interaction.options.getInteger('equipe');
        const player = interaction.options.getUser('joueur');

        const result = await authenticatedFetch(`/teams/${teamId}/members`, {
            method: 'DELETE',
            body: JSON.stringify({ discord_id: player.id })
        }, interaction.user.id);

        if (result.error) {
            let errorMessage = result.error;

            if (!result.authError) {
                if (result.status === 403) {
                    errorMessage = 'Vous devez être capitaine de l\'équipe pour retirer des membres.';
                }
            }

            return await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Erreur - Retrait de membre')
                    .setDescription(errorMessage)
                    .setTimestamp()]
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Membre retiré avec succès!')
            .addFields(
                { name: '👤 Joueur', value: `<@${player.id}>`, inline: true },
                { name: '🏷️ Équipe', value: `ID: ${teamId}`, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Erreur lors du retrait de membre:', error);
        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Erreur - Retrait de membre')
                .setDescription(error.name === 'TimeoutError'
                    ? 'Timeout - L\'API ne répond pas'
                    : 'Erreur de connexion à l\'API')
                .setTimestamp()]
        });
    }
}
