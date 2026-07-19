const { EmbedBuilder } = require('discord.js');

/**
 * Notifie par message privé les capitaines des deux équipes d'un match qui vient
 * d'être planifié automatiquement. Déduplique si un même capitaine dirige les
 * deux équipes, ignore les capitaines sans discord lié et reste résilient si un
 * envoi échoue (DM fermés).
 *
 * @param {import('discord.js').Client} client
 * @param {{ id: number, team1?: string, team2?: string, team1_captain_discord?: string, team2_captain_discord?: string }} game
 * @param {Date} date
 */
async function notifyCaptains(client, game, date) {
    if (!client) return;

    const captainDiscordIds = [game.team1_captain_discord, game.team2_captain_discord];
    const alreadyNotified = new Set();

    for (const discordId of captainDiscordIds) {
        if (!discordId || alreadyNotified.has(discordId)) {
            continue;
        }
        alreadyNotified.add(discordId);

        try {
            const user = await client.users.fetch(discordId);
            const embed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('⏰ Match planifié automatiquement')
                .setDescription(
                    `Faute de planification avant le jour butoir, votre match ` +
                    `**${game.team1 || '?'} vs ${game.team2 || '?'}** a été programmé à l'horaire par défaut.`
                )
                .addFields({ name: 'Date', value: date.toLocaleString('fr-FR'), inline: true })
                .setFooter({ text: 'Vous pouvez le replanifier avec /planifier si besoin.' })
                .setTimestamp();

            await user.send({ embeds: [embed] });
            console.log(`[Deadline] Capitaine ${discordId} notifié pour le match #${game.id}.`);
        } catch (error) {
            console.error(`[Deadline] Échec de la notification du capitaine ${discordId}:`, error);
        }
    }
}

exports.notifyCaptains = notifyCaptains;
