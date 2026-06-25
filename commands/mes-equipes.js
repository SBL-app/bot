import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { authenticatedFetch } from '../utils/authenticatedApi.js';

export const data = new SlashCommandBuilder()
    .setName('mes-equipes')
    .setDescription('Affiche la liste de vos équipes');

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
        const result = await authenticatedFetch('/users/me/teams', {
            method: 'GET'
        }, interaction.user.id);

        if (result.error) {
            return await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Erreur - Mes équipes')
                    .setDescription(result.error)
                    .setTimestamp()]
            });
        }

        const teams = result.data;

        if (!teams || teams.length === 0) {
            return await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('📋 Mes équipes')
                    .setDescription('Vous n\'appartenez à aucune équipe.\nUtilisez `/creer-equipe` pour en créer une.')
                    .setTimestamp()]
            });
        }

        const teamsList = teams.map(t => {
            const roleIcon = t.role === 'captain' ? '👑' : '👤';
            const roleLabel = t.role === 'captain' ? 'Capitaine' : 'Membre';
            return `${roleIcon} **${t.team.name}** (ID: ${t.team.id})\n   ${roleLabel} · ${t.members_count} membre(s)`;
        }).join('\n\n');

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('📋 Mes équipes')
            .setDescription(teamsList)
            .setFooter({ text: `${teams.length} équipe(s)` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Erreur lors de la récupération des équipes:', error);
        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Erreur - Mes équipes')
                .setDescription(error.name === 'TimeoutError'
                    ? 'Timeout - L\'API ne répond pas'
                    : 'Erreur de connexion à l\'API')
                .setTimestamp()]
        });
    }
}
