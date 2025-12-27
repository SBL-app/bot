const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('propositions')
        .setDescription('Voir les propositions de match en attente'),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            // Récupérer les propositions de l'utilisateur
            const response = await fetch(`${config.apiUrl}/match-proposals/pending?discord_id=${interaction.user.id}`, {
                headers: {
                    'User-Agent': 'SBL-Discord-Bot',
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(15000)
            });

            const data = await response.json();

            if (!response.ok) {
                let errorMessage = data.error || 'Erreur inconnue';
                if (errorMessage.includes('not found')) {
                    errorMessage = 'Votre compte Discord n\'est pas lié. Connectez-vous sur le site web avec Discord.';
                }

                return await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('Erreur')
                        .setDescription(errorMessage)
                        .setTimestamp()]
                });
            }

            const { received, sent } = data;

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('Propositions de match')
                .setTimestamp();

            // Propositions reçues
            if (received.length > 0) {
                const receivedText = received.map(p => {
                    const game = p.game || {};
                    const date = new Date(p.proposed_date);
                    return `**#${p.id}** - ${game.team1 || '?'} vs ${game.team2 || '?'}\n` +
                           `   ${formatDate(date)} - de ${p.proposer?.discord_username || 'Inconnu'}`;
                }).join('\n\n');

                embed.addFields({
                    name: `Reçues (${received.length})`,
                    value: receivedText.length > 1024 ? receivedText.substring(0, 1020) + '...' : receivedText,
                    inline: false
                });
            } else {
                embed.addFields({
                    name: 'Reçues',
                    value: '*Aucune proposition en attente*',
                    inline: false
                });
            }

            // Propositions envoyées
            if (sent.length > 0) {
                const sentText = sent.map(p => {
                    const game = p.game || {};
                    const date = new Date(p.proposed_date);
                    return `**#${p.id}** - ${game.team1 || '?'} vs ${game.team2 || '?'}\n` +
                           `   ${formatDate(date)} - vers ${p.receiver?.discord_username || 'Inconnu'}`;
                }).join('\n\n');

                embed.addFields({
                    name: `Envoyées (${sent.length})`,
                    value: sentText.length > 1024 ? sentText.substring(0, 1020) + '...' : sentText,
                    inline: false
                });
            } else {
                embed.addFields({
                    name: 'Envoyées',
                    value: '*Aucune proposition envoyée*',
                    inline: false
                });
            }

            // Ajouter les instructions
            if (received.length > 0) {
                embed.addFields({
                    name: 'Actions',
                    value: '`/accepter <id>` - Accepter une proposition\n' +
                           '`/refuser <id>` - Refuser une proposition\n' +
                           '`/planifier <match> <jour> <heure>` - Contre-proposer',
                    inline: false
                });
            }

            // Créer des boutons pour les premières propositions reçues
            const components = [];
            if (received.length > 0) {
                const row = new ActionRowBuilder();
                const buttonsToAdd = Math.min(received.length, 4);

                for (let i = 0; i < buttonsToAdd; i++) {
                    const p = received[i];
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`proposal_actions_${p.id}`)
                            .setLabel(`#${p.id}`)
                            .setStyle(ButtonStyle.Primary)
                    );
                }

                components.push(row);
            }

            await interaction.editReply({ embeds: [embed], components });

        } catch (error) {
            console.error('Erreur lors de la récupération des propositions:', error);

            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('Erreur')
                    .setDescription(error.name === 'TimeoutError' ? 'L\'API ne répond pas.' : error.message)
                    .setTimestamp()]
            });
        }
    },
};

function formatDate(date) {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const day = days[date.getDay()];
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const dateStr = date.toLocaleDateString('fr-FR');
    return `${day} ${dateStr} à ${hours}h${minutes}`;
}
