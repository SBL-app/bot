const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { API_URL } = require('../apiConfig');
const fs = require('fs');
const path = require('path');

const settingsConfigPath = path.join(__dirname, '../config/settings.json');

function loadSettingsConfig() {
    try {
        return JSON.parse(fs.readFileSync(settingsConfigPath, 'utf8'));
    } catch (error) {
        return { match_manager_role_id: null };
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('accepter')
        .setDescription('Accepter une proposition de match')
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('ID de la proposition')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        // Vérifier le rôle requis
        const settings = loadSettingsConfig();
        if (settings.match_manager_role_id) {
            const member = interaction.member;
            if (!member.roles.cache.has(settings.match_manager_role_id)) {
                return await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('Accès refusé')
                        .setDescription(`Vous devez avoir le rôle <@&${settings.match_manager_role_id}> pour utiliser cette commande.`)
                        .setTimestamp()]
                });
            }
        }

        try {
            const proposalId = interaction.options.getInteger('id');

            // Appeler l'API pour accepter la proposition
            const response = await fetch(`${API_URL}/match-proposals/${proposalId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'SBL-Discord-Bot',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    discord_id: interaction.user.id,
                    status: 'accepted'
                }),
                signal: AbortSignal.timeout(15000)
            });

            const data = await response.json();

            if (!response.ok) {
                let errorMessage = data.error || 'Erreur inconnue';

                if (errorMessage.includes('Only the receiver')) {
                    errorMessage = 'Seul le destinataire peut accepter cette proposition.';
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
                        .setColor(0x00FF00)
                        .setTitle('Proposition acceptée !')
                        .setDescription(`**${interaction.user.username}** a accepté votre proposition pour le match **${game.team1 || '?'} vs ${game.team2 || '?'}**`)
                        .addFields(
                            { name: 'Date confirmée', value: formatDate(new Date(proposal.proposed_date)), inline: true }
                        )
                        .setTimestamp();

                    await proposer.send({ embeds: [dmEmbed] });
                } catch (dmError) {
                    console.error('Erreur lors de l\'envoi du DM:', dmError);
                }
            }

            // Confirmation à l'utilisateur
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('Proposition acceptée')
                    .setDescription(`Le match **${game.team1 || '?'} vs ${game.team2 || '?'}** est maintenant planifié.`)
                    .addFields(
                        { name: 'Date', value: formatDate(new Date(proposal.proposed_date)), inline: true }
                    )
                    .setTimestamp()]
            });

        } catch (error) {
            console.error('Erreur lors de l\'acceptation:', error);

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
