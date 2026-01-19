const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { API_URL } = require('../apiConfig');

const DAYS_FR = {
    'lundi': 1,
    'mardi': 2,
    'mercredi': 3,
    'jeudi': 4,
    'vendredi': 5,
    'samedi': 6,
    'dimanche': 0
};

function getNextDayDate(dayName, time) {
    const today = new Date();
    const targetDay = DAYS_FR[dayName.toLowerCase()];
    if (targetDay === undefined) return null;

    const currentDay = today.getDay();
    let daysUntilTarget = targetDay - currentDay;
    if (daysUntilTarget <= 0) {
        daysUntilTarget += 7;
    }

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysUntilTarget);

    // Parser l'heure
    const timeParts = time.match(/^(\d{1,2})[h:]?(\d{0,2})$/i);
    if (!timeParts) return null;

    const hours = parseInt(timeParts[1]);
    const minutes = parseInt(timeParts[2] || '0');

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

    targetDate.setHours(hours, minutes, 0, 0);
    return targetDate;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('planifier')
        .setDescription('Proposer une date pour un match')
        .addIntegerOption(option =>
            option.setName('match')
                .setDescription('ID du match')
                .setRequired(true)
                .setMinValue(1))
        .addStringOption(option =>
            option.setName('jour')
                .setDescription('Jour du match')
                .setRequired(true)
                .addChoices(
                    { name: 'Lundi', value: 'lundi' },
                    { name: 'Mardi', value: 'mardi' },
                    { name: 'Mercredi', value: 'mercredi' },
                    { name: 'Jeudi', value: 'jeudi' },
                    { name: 'Vendredi', value: 'vendredi' },
                    { name: 'Samedi', value: 'samedi' },
                    { name: 'Dimanche', value: 'dimanche' }
                ))
        .addStringOption(option =>
            option.setName('heure')
                .setDescription('Heure du match (ex: 21h, 20h30, 21:00)')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const gameId = interaction.options.getInteger('match');
            const day = interaction.options.getString('jour');
            const time = interaction.options.getString('heure');

            // Calculer la date proposée
            const proposedDate = getNextDayDate(day, time);
            if (!proposedDate) {
                return await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('Erreur')
                        .setDescription('Format d\'heure invalide. Utilisez: 21h, 20h30, ou 21:00')
                        .setTimestamp()]
                });
            }

            // Appeler l'API pour créer la proposition
            const response = await fetch(`${API_URL}/match-proposals`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'SBL-Discord-Bot',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    game_id: gameId,
                    proposer_discord_id: interaction.user.id,
                    proposed_date: proposedDate.toISOString()
                }),
                signal: AbortSignal.timeout(15000)
            });

            const data = await response.json();

            if (!response.ok) {
                let errorMessage = data.error || 'Erreur inconnue';

                if (errorMessage.includes('team captain')) {
                    errorMessage = 'Vous devez être capitaine d\'une des équipes de ce match.';
                } else if (errorMessage.includes('not found')) {
                    errorMessage = 'Match ou utilisateur introuvable.';
                } else if (errorMessage.includes('linked their Discord')) {
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

            const proposal = data.proposal;
            const game = proposal.game;

            // Notifier le capitaine adverse en DM
            if (data.receiver_discord_id) {
                try {
                    const receiver = await interaction.client.users.fetch(data.receiver_discord_id);
                    const dmEmbed = new EmbedBuilder()
                        .setColor(0x0099FF)
                        .setTitle('Nouvelle proposition de match')
                        .setDescription(`**${interaction.user.username}** vous propose une date pour le match **${game.team1} vs ${game.team2}**`)
                        .addFields(
                            { name: 'Date proposée', value: formatDate(proposedDate), inline: true },
                            { name: 'Semaine', value: `${game.week}`, inline: true },
                            { name: 'ID Proposition', value: `${proposal.id}`, inline: true }
                        )
                        .addFields({
                            name: 'Actions',
                            value: 'Utilisez `/accepter` ou `/refuser` avec l\'ID de la proposition, ou `/planifier` pour contre-proposer.',
                            inline: false
                        })
                        .setTimestamp();

                    await receiver.send({ embeds: [dmEmbed] });
                } catch (dmError) {
                    console.error('Erreur lors de l\'envoi du DM:', dmError);
                }
            }

            // Confirmation à l'utilisateur
            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('Proposition envoyée')
                    .setDescription(`Votre proposition pour **${game.team1} vs ${game.team2}** a été envoyée.`)
                    .addFields(
                        { name: 'Date proposée', value: formatDate(proposedDate), inline: true },
                        { name: 'ID Proposition', value: `${proposal.id}`, inline: true }
                    )
                    .setTimestamp()]
            });

        } catch (error) {
            console.error('Erreur lors de la planification:', error);

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
