import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import config from '../config.json' with { type: 'json' };

const API_URL = process.env.API_URL || config.apiUrl;

export const data = new SlashCommandBuilder()
    .setName('standings')
    .setDescription('Affiche le classement actuel d\'une division')
    .addIntegerOption(option =>
        option.setName('division')
            .setDescription('ID de la division')
            .setRequired(true)
            .setMinValue(1));

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const divisionId = interaction.options.getInteger('division');

    try {
        const response = await fetch(`${API_URL}/divisions/${divisionId}/details`, {
            headers: { 'User-Agent': 'SBL-Discord-Bot', 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            const msg = response.status === 404
                ? `Division ${divisionId} introuvable.`
                : `Erreur API: ${response.status}`;
            throw new Error(msg);
        }

        const data = await response.json();
        const ranking = data.ranking || [];
        const divisionName = (data.division && data.division.name) || `Division ${divisionId}`;

        if (ranking.length === 0) {
            return await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle(`🏆 Classement - ${divisionName}`)
                    .setDescription('Aucune équipe classée dans cette division.')
                    .setTimestamp()]
            });
        }

        const lines = ranking.map(entry => {
            const pos = entry.position;
            const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `**${pos}.**`;
            const s = entry.stats || {};
            const wins = s.wins ?? 0;
            const losses = s.losses ?? 0;
            const ties = s.ties ?? 0;
            const points = s.points ?? 0;
            return `${medal} **${entry.team_name}** — ${points} pts \`(${wins}V ${losses}D ${ties}N)\``;
        });

        // Découper si la description dépasse la limite Discord (4096)
        let description = lines.join('\n');
        if (description.length > 4000) {
            description = description.substring(0, 3997) + '...';
        }

        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`🏆 Classement - ${divisionName}`)
                .setDescription(description)
                .setFooter({ text: `${ranking.length} équipe(s) · V=victoires D=défaites N=nuls` })
                .setTimestamp()]
        });

    } catch (error) {
        let errorMessage = error.message || 'Erreur de connexion à l\'API';
        if (error.name === 'TimeoutError') errorMessage = 'Timeout - L\'API ne répond pas';
        else if (error.code === 'ECONNREFUSED') errorMessage = 'Connexion refusée par le serveur';

        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Erreur - Classement')
                .setDescription(errorMessage)
                .setTimestamp()]
        });
    }
}
