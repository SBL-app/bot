const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { sendWeeklyMessagesNow } = require('../scheduler/weekly-messages');

const channelsConfigPath = path.join(__dirname, '../config/channels.json');
const settingsConfigPath = path.join(__dirname, '../config/settings.json');

function loadChannelsConfig() {
    try {
        return JSON.parse(fs.readFileSync(channelsConfigPath, 'utf8'));
    } catch (error) {
        return { matchs_channel_id: null, classement_channel_id: null };
    }
}

function saveChannelsConfig(config) {
    fs.writeFileSync(channelsConfigPath, JSON.stringify(config, null, 4));
}

function loadSettingsConfig() {
    try {
        return JSON.parse(fs.readFileSync(settingsConfigPath, 'utf8'));
    } catch (error) {
        return { deadline_day: 'thursday', default_match_day: 'sunday', default_match_time: '21:00' };
    }
}

function saveSettingsConfig(config) {
    fs.writeFileSync(settingsConfigPath, JSON.stringify(config, null, 4));
}

const DAYS_FR = {
    'monday': 'Lundi',
    'tuesday': 'Mardi',
    'wednesday': 'Mercredi',
    'thursday': 'Jeudi',
    'friday': 'Vendredi',
    'saturday': 'Samedi',
    'sunday': 'Dimanche'
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Configuration du bot (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('matchs-channel')
                .setDescription('Configurer le salon pour les matchs de la semaine')
                .addChannelOption(option =>
                    option.setName('salon')
                        .setDescription('Salon pour les matchs')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('classement-channel')
                .setDescription('Configurer le salon pour le classement')
                .addChannelOption(option =>
                    option.setName('salon')
                        .setDescription('Salon pour le classement')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('jour-butoir')
                .setDescription('Configurer le jour limite pour la planification des matchs')
                .addStringOption(option =>
                    option.setName('jour')
                        .setDescription('Jour de la semaine')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Lundi', value: 'monday' },
                            { name: 'Mardi', value: 'tuesday' },
                            { name: 'Mercredi', value: 'wednesday' },
                            { name: 'Jeudi', value: 'thursday' },
                            { name: 'Vendredi', value: 'friday' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('horaire-defaut')
                .setDescription('Configurer l\'horaire par défaut des matchs')
                .addStringOption(option =>
                    option.setName('jour')
                        .setDescription('Jour de la semaine')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Lundi', value: 'monday' },
                            { name: 'Mardi', value: 'tuesday' },
                            { name: 'Mercredi', value: 'wednesday' },
                            { name: 'Jeudi', value: 'thursday' },
                            { name: 'Vendredi', value: 'friday' },
                            { name: 'Samedi', value: 'saturday' },
                            { name: 'Dimanche', value: 'sunday' }
                        ))
                .addStringOption(option =>
                    option.setName('heure')
                        .setDescription('Heure (format HH:MM)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Afficher la configuration actuelle'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('test-messages')
                .setDescription('Envoyer les messages hebdomadaires maintenant (test)'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('role-gestionnaire-matchs')
                .setDescription('Configurer le rôle requis pour planifier/accepter/refuser les matchs')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Rôle requis (laisser vide pour désactiver)')
                        .setRequired(false))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'matchs-channel') {
            const channel = interaction.options.getChannel('salon');
            const config = loadChannelsConfig();
            config.matchs_channel_id = channel.id;
            saveChannelsConfig(config);

            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('Configuration mise à jour')
                    .setDescription(`Le salon des matchs de la semaine est maintenant <#${channel.id}>`)
                    .setTimestamp()],
                ephemeral: true
            });
        }
        else if (subcommand === 'classement-channel') {
            const channel = interaction.options.getChannel('salon');
            const config = loadChannelsConfig();
            config.classement_channel_id = channel.id;
            saveChannelsConfig(config);

            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('Configuration mise à jour')
                    .setDescription(`Le salon du classement est maintenant <#${channel.id}>`)
                    .setTimestamp()],
                ephemeral: true
            });
        }
        else if (subcommand === 'jour-butoir') {
            const day = interaction.options.getString('jour');
            const config = loadSettingsConfig();
            config.deadline_day = day;
            saveSettingsConfig(config);

            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('Configuration mise à jour')
                    .setDescription(`Le jour butoir pour la planification est maintenant **${DAYS_FR[day]}**`)
                    .setTimestamp()],
                ephemeral: true
            });
        }
        else if (subcommand === 'horaire-defaut') {
            const day = interaction.options.getString('jour');
            const time = interaction.options.getString('heure');

            // Valider le format de l'heure
            const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
            if (!timeRegex.test(time)) {
                return await interaction.reply({
                    embeds: [new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('Erreur')
                        .setDescription('Format d\'heure invalide. Utilisez le format HH:MM (ex: 21:00)')
                        .setTimestamp()],
                    ephemeral: true
                });
            }

            const config = loadSettingsConfig();
            config.default_match_day = day;
            config.default_match_time = time;
            saveSettingsConfig(config);

            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('Configuration mise à jour')
                    .setDescription(`L'horaire par défaut des matchs est maintenant **${DAYS_FR[day]} à ${time}**`)
                    .setTimestamp()],
                ephemeral: true
            });
        }
        else if (subcommand === 'list') {
            const channelsConfig = loadChannelsConfig();
            const settingsConfig = loadSettingsConfig();

            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('Configuration actuelle')
                .setTimestamp();

            // Salons
            const matchsChannel = channelsConfig.matchs_channel_id
                ? `<#${channelsConfig.matchs_channel_id}>`
                : '*Non configuré*';
            const classementChannel = channelsConfig.classement_channel_id
                ? `<#${channelsConfig.classement_channel_id}>`
                : '*Non configuré*';

            const matchManagerRole = settingsConfig.match_manager_role_id
                ? `<@&${settingsConfig.match_manager_role_id}>`
                : '*Non configuré (tout le monde)*';

            embed.addFields(
                { name: 'Salon des matchs', value: matchsChannel, inline: true },
                { name: 'Salon du classement', value: classementChannel, inline: true },
                { name: '\u200B', value: '\u200B', inline: false },
                { name: 'Jour butoir', value: DAYS_FR[settingsConfig.deadline_day] || settingsConfig.deadline_day, inline: true },
                { name: 'Horaire par défaut', value: `${DAYS_FR[settingsConfig.default_match_day] || settingsConfig.default_match_day} à ${settingsConfig.default_match_time}`, inline: true },
                { name: '\u200B', value: '\u200B', inline: false },
                { name: 'Rôle gestionnaire matchs', value: matchManagerRole, inline: true }
            );

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
        else if (subcommand === 'test-messages') {
            await interaction.deferReply({ ephemeral: true });

            const channelsConfig = loadChannelsConfig();
            if (!channelsConfig.matchs_channel_id && !channelsConfig.classement_channel_id) {
                return await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('Erreur')
                        .setDescription('Aucun salon n\'est configuré. Utilisez `/config matchs-channel` et `/config classement-channel` d\'abord.')
                        .setTimestamp()]
                });
            }

            try {
                await sendWeeklyMessagesNow(interaction.client);
                await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor(0x00FF00)
                        .setTitle('Messages envoyés')
                        .setDescription('Les messages hebdomadaires ont été envoyés dans les salons configurés.')
                        .setTimestamp()]
                });
            } catch (error) {
                console.error('Erreur lors du test des messages:', error);
                await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('Erreur')
                        .setDescription(`Erreur lors de l'envoi des messages: ${error.message}`)
                        .setTimestamp()]
                });
            }
        }
        else if (subcommand === 'role-gestionnaire-matchs') {
            const role = interaction.options.getRole('role');
            const config = loadSettingsConfig();
            config.match_manager_role_id = role ? role.id : null;
            saveSettingsConfig(config);

            const message = role
                ? `Le rôle requis pour les commandes de match est maintenant <@&${role.id}>`
                : 'Le rôle requis pour les commandes de match a été désactivé (tout le monde peut les utiliser)';

            await interaction.reply({
                embeds: [new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('Configuration mise à jour')
                    .setDescription(message)
                    .setTimestamp()],
                ephemeral: true
            });
        }
    },
};
