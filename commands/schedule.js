import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import config from '../config.json' with { type: 'json' };

const API_URL = process.env.API_URL || config.apiUrl;
const MAX_GAMES = 15;

export const data = new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Affiche le planning des prochains matchs d\'une division ou d\'une équipe')
    .addIntegerOption(option =>
        option.setName('division')
            .setDescription('ID de la division')
            .setRequired(false)
            .setMinValue(1))
    .addIntegerOption(option =>
        option.setName('equipe')
            .setDescription('ID de l\'équipe')
            .setRequired(false)
            .setMinValue(1));

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const divisionId = interaction.options.getInteger('division');
    const teamId = interaction.options.getInteger('equipe');

    if (!divisionId && !teamId) {
        return await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('⚠️ Paramètre manquant')
                .setDescription('Précisez une `division` ou une `equipe`.')
                .setTimestamp()]
        });
    }

    // team_id est prioritaire ; l'API accepte les deux ensemble
    const params = new URLSearchParams();
    if (teamId) params.set('team_id', teamId);
    if (divisionId) params.set('division_id', divisionId);

    const scope = teamId ? `Équipe ${teamId}` : `Division ${divisionId}`;

    try {
        const response = await fetch(`${API_URL}/games?${params.toString()}`, {
            headers: { 'User-Agent': 'SBL-Discord-Bot', 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15000),
        });

        if (!response.ok) {
            throw new Error(response.status === 404
                ? 'Aucun match trouvé.'
                : `Erreur API: ${response.status}`);
        }

        const games = await response.json();
        if (!Array.isArray(games)) {
            throw new Error('Format de données non reconnu de l\'API');
        }

        // Prochains matchs = pas encore joués
        const upcoming = games
            .filter(g => g.status !== 'played')
            .sort((a, b) => {
                if (!a.date) return 1;
                if (!b.date) return -1;
                return new Date(a.date) - new Date(b.date);
            });

        if (upcoming.length === 0) {
            return await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle(`📅 Planning - ${scope}`)
                    .setDescription('Aucun match à venir.')
                    .setTimestamp()]
            });
        }

        const shown = upcoming.slice(0, MAX_GAMES);
        const lines = shown.map(g => {
            const when = g.date ? formatDate(g.date) : '📌 Date à définir';
            return `**${g.team1}** vs **${g.team2}**\n📅 ${when} · Semaine ${g.week} · Match #${g.id}`;
        });

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`📅 Planning - ${scope}`)
            .setDescription(lines.join('\n\n'))
            .setTimestamp();

        if (upcoming.length > MAX_GAMES) {
            embed.setFooter({ text: `Affichage des ${MAX_GAMES} prochains sur ${upcoming.length} matchs à venir` });
        } else {
            embed.setFooter({ text: `${upcoming.length} match(s) à venir` });
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        let errorMessage = error.message || 'Erreur de connexion à l\'API';
        if (error.name === 'TimeoutError') errorMessage = 'Timeout - L\'API ne répond pas';
        else if (error.code === 'ECONNREFUSED') errorMessage = 'Connexion refusée par le serveur';

        await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Erreur - Planning')
                .setDescription(errorMessage)
                .setTimestamp()]
        });
    }
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR', {
            weekday: 'long', day: '2-digit', month: '2-digit',
            hour: '2-digit', minute: '2-digit', hour12: false,
        });
    } catch {
        return dateString;
    }
}
