const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Affiche les informations du serveur'),
    
    async execute(interaction) {
        const { guild } = interaction;
        
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`Informations du serveur: ${guild.name}`)
            .setThumbnail(guild.iconURL())
            .addFields(
                { name: 'ID du serveur', value: guild.id, inline: true },
                { name: 'Propriétaire', value: `<@${guild.ownerId}>`, inline: true },
                { name: 'Membres', value: `${guild.memberCount}`, inline: true },
                { name: 'Créé le', value: guild.createdAt.toDateString(), inline: true },
                { name: 'Région', value: guild.preferredLocale, inline: true },
                { name: 'Niveau de vérification', value: guild.verificationLevel.toString(), inline: true }
            )
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    },
};
