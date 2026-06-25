import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { authenticatedFetch } from '../utils/authenticatedApi.js';

export const data = new SlashCommandBuilder()
    .setName('changer-role')
    .setDescription('Change le rôle d\'un membre de l\'équipe (capitaine uniquement)')
    .addIntegerOption(option =>
        option.setName('equipe')
            .setDescription('ID de l\'équipe')
            .setRequired(true)
            .setMinValue(1))
    .addUserOption(option =>
        option.setName('joueur')
            .setDescription('Joueur dont changer le rôle')
            .setRequired(true))
    .addStringOption(option =>
        option.setName('role')
            .setDescription('Nouveau rôle')
            .setRequired(true)
            .addChoices(
                { name: 'Capitaine', value: 'captain' },
                { name: 'Membre', value: 'member' }
            ));

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const teamId = interaction.options.getInteger('equipe');
        const player = interaction.options.getUser('joueur');
        const role = interaction.options.getString('role');

        const result = await authenticatedFetch(`/teams/${teamId}/members/role`, {
            method: 'PATCH',
            body: JSON.stringify({
                discord_id: player.id,
                role: role
            })
        }, interaction.user.id);

        if (result.error) {
            let errorMessage = result.error;

            if (!result.authError) {
                if (result.status === 403) {
                    errorMessage = 'Vous devez être capitaine de l\'équipe pour changer les rôles.';
                }
            }

            return await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Erreur - Changement de rôle')
                    .setDescription(errorMessage)
                    .setTimestamp()]
            });
        }

        const roleLabel = role === 'captain' ? '👑 Capitaine' : '👤 Membre';

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Rôle mis à jour!')
            .addFields(
                { name: '👤 Joueur', value: `<@${player.id}>`, inline: true },
                { name: '🏷️ Équipe', value: `ID: ${teamId}`, inline: true },
                { name: '🎭 Nouveau rôle', value: roleLabel, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Erreur lors du changement de rôle:', error);
        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Erreur - Changement de rôle')
                .setDescription(error.name === 'TimeoutError'
                    ? 'Timeout - L\'API ne répond pas'
                    : 'Erreur de connexion à l\'API')
                .setTimestamp()]
        });
    }
}
