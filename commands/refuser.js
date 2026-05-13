const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { authenticatedFetch } = require('../utils/authenticatedApi');
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
        .setName('refuser')
        .setDescription('Refuser une proposition de match')
        .addIntegerOption(option =>
            option.setName('id')
                .setDescription('ID de la proposition')
                .setRequired(true)
                .setMinValue(1)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

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

        const proposalId = interaction.options.getInteger('id');

        const result = await authenticatedFetch(`/match-proposals/${proposalId}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: 'rejected' }),
        }, interaction.user.id);

        if (result.error) {
            let errorMessage = result.error;
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

        const proposal = result.data.proposal;
        const game = proposal.game || {};

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
