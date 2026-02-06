const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inscription')
        .setDescription('Inscrit une nouvelle équipe pour la prochaine saison')
        .addStringOption(option =>
            option.setName('nom')
                .setDescription('Nom de l\'équipe')
                .setRequired(true)
                .setMinLength(2)
                .setMaxLength(50))
        .addUserOption(option =>
            option.setName('capitaine')
                .setDescription('Capitaine de l\'équipe (doit avoir un compte lié)')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('joueur1')
                .setDescription('Premier joueur de l\'équipe')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('joueur2')
                .setDescription('Deuxième joueur de l\'équipe')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('joueur3')
                .setDescription('Troisième joueur de l\'équipe (optionnel)')
                .setRequired(false))
        .addUserOption(option =>
            option.setName('joueur4')
                .setDescription('Quatrième joueur de l\'équipe (optionnel)')
                .setRequired(false)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('⚠️ Commande dépréciée')
            .setDescription(
                'La commande `/inscription` a été remplacée par un nouveau système de gestion d\'équipe.\n\n' +
                '**Nouvelles commandes :**\n' +
                '> `/creer-equipe` — Créer une équipe (vous devenez capitaine)\n' +
                '> `/ajouter-membre` — Ajouter un joueur à votre équipe\n' +
                '> `/mes-equipes` — Voir vos équipes\n' +
                '> `/equipe-membres` — Voir les membres d\'une équipe\n' +
                '> `/changer-role` — Promouvoir/rétrograder un membre\n' +
                '> `/quitter-equipe` — Quitter une équipe\n' +
                '> `/retirer-membre` — Retirer un joueur de votre équipe'
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    },
};
