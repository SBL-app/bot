import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { authenticatedFetch } from '../utils/authenticatedApi.js';
import config from '../config.json' with { type: 'json' };

const API_URL = process.env.API_URL || config.apiUrl;

export const data = new SlashCommandBuilder()
    .setName('result')
    .setDescription('Soumettre le résultat d\'un match (en attente de validation de l\'adversaire)')
    .addIntegerOption(option =>
        option.setName('match')
            .setDescription('ID du match')
            .setRequired(true)
            .setMinValue(1))
    .addIntegerOption(option =>
        option.setName('score1')
            .setDescription('Score de l\'équipe 1 (première équipe affichée)')
            .setRequired(true)
            .setMinValue(0))
    .addIntegerOption(option =>
        option.setName('score2')
            .setDescription('Score de l\'équipe 2 (seconde équipe affichée)')
            .setRequired(true)
            .setMinValue(0));

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const gameId = interaction.options.getInteger('match');
    const score1 = interaction.options.getInteger('score1');
    const score2 = interaction.options.getInteger('score2');

    // Récupérer les noms des équipes pour un affichage clair (best-effort, non bloquant)
    let team1 = 'Équipe 1';
    let team2 = 'Équipe 2';
    try {
        const gameResp = await fetch(`${API_URL}/games/${gameId}`, {
            headers: { 'User-Agent': 'SBL-Discord-Bot', 'Accept': 'application/json' },
            signal: AbortSignal.timeout(15000),
        });
        if (gameResp.ok) {
            const game = await gameResp.json();
            team1 = game.team1 || team1;
            team2 = game.team2 || team2;
        }
    } catch {
        // ignore : l'affichage générique suffit
    }

    const result = await authenticatedFetch(`/games/${gameId}/submit-result`, {
        method: 'POST',
        body: JSON.stringify({ score1, score2 }),
    }, interaction.user.id);

    if (result.error) {
        let errorMessage = result.error;
        if (errorMessage.includes('captain')) {
            errorMessage = 'Vous devez être capitaine d\'une des équipes de ce match.';
        } else if (errorMessage.includes('pending')) {
            errorMessage = 'Un résultat est déjà en attente de validation pour ce match.';
        } else if (errorMessage.toLowerCase().includes('not found')) {
            errorMessage = 'Match introuvable.';
        } else if (errorMessage.includes('linked their Discord') || errorMessage.includes('User not found')) {
            errorMessage = 'Votre compte Discord n\'est pas lié. Connectez-vous sur le site web avec Discord.';
        }

        return await interaction.editReply({
            embeds: [new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Erreur - Résultat')
                .setDescription(errorMessage)
                .setTimestamp()]
        });
    }

    await interaction.editReply({
        embeds: [new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ Résultat soumis')
            .setDescription(`**${team1}** ${score1} - ${score2} **${team2}**`)
            .addFields({
                name: 'En attente',
                value: 'Le capitaine de l\'équipe adverse doit valider ce résultat avant qu\'il soit officiel.',
                inline: false
            })
            .setFooter({ text: `Match #${gameId}` })
            .setTimestamp()]
    });
}
