const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { API_URL } = require('../apiConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('refuser')
        .setDescription('Refuser une proposition de match')
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('ID de la proposition')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const proposalId = interaction.options.getInteger('id');

            // Appeler l'API pour refuser la proposition
            const response = await fetch(`${API_URL}/match-proposals/${proposalId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'SBL-Discord-Bot',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    discord_id: interaction.user.id,
                    status: 'rejected'
                }),
                signal: AbortSignal.timeout(15000)
            });

            const data = await response.json();

            if (!response.ok) {
                let errorMessage = data.error || 'Erreur inconnue';

                if (errorMessage.includes('Only the receiver')) {
                    errorMessage = 'Seul le destinataire peut refuser cette proposition.';
                } else if (errorMessage.includes('not found')) {
                    errorMessage = 'Proposition introuvable.';
                }

                return await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('Erreur')
                        .setDescription(errorMessage)
                        .setTimestamp()]
                });
            }

            const proposal = data.proposal;
            const game = proposal.game || {};

            // Notifier le proposer en DM
            if (proposal.proposer?.discord_id) {
                try {
                    const proposer = await interaction.client.users.fetch(proposal.proposer.discord_id);
                    const dmEmbed = new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('Proposition refusée')
                        .setDescription(`**${interaction.user.username}** a refusé votre proposition pour le match **${game.team1 || '?'} vs ${game.team2 || '?'}**`)
                        .addFields(
                            { name: 'Date proposée', value: formatDate(new Date(proposal.proposed_date)), inline: true }
                        )
                        .addFields({
                            name: 'Que faire ?',
                            value: 'Vous pouvez faire une nouvelle proposition avec `/planifier`.',
                            inline: false
                        })
                        .setTimestamp();

                    await proposer.send({ embeds: [dmEmbed] });
                } catch (dmError) {
                    console.error('Erreur lors de l\'envoi du DM:', dmError);
                }
            }

            // Confirmation à l'utilisateur
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle('Proposition refusée')
                    .setDescription(`Vous avez refusé la proposition pour **${game.team1 || '?'} vs ${game.team2 || '?'}**.`)
                    .addFields({
                        name: 'Conseil',
                        value: 'N\'oubliez pas de proposer une contre-date avec `/planifier` si nécessaire.',
                        inline: false
                    })
                    .setTimestamp()]
            });

        } catch (error) {
            console.error('Erreur lors du refus:', error);

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
