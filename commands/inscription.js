const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const config = require('../config.json');

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

        try {
            const teamName = interaction.options.getString('nom');
            const captain = interaction.options.getUser('capitaine');

            // Collecter tous les joueurs
            const players = [];
            const joueur1 = interaction.options.getUser('joueur1');
            const joueur2 = interaction.options.getUser('joueur2');
            const joueur3 = interaction.options.getUser('joueur3');
            const joueur4 = interaction.options.getUser('joueur4');

            // Ajouter les joueurs à la liste
            if (joueur1) players.push(joueur1);
            if (joueur2) players.push(joueur2);
            if (joueur3) players.push(joueur3);
            if (joueur4) players.push(joueur4);

            // Vérifier que le capitaine est dans la liste des joueurs
            const captainInPlayers = players.some(p => p.id === captain.id);
            if (!captainInPlayers) {
                // Ajouter le capitaine à la liste des joueurs s'il n'y est pas
                players.unshift(captain);
            }

            // Vérifier qu'il n'y a pas de doublons
            const uniqueIds = new Set(players.map(p => p.id));
            if (uniqueIds.size !== players.length) {
                return await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('❌ Erreur - Inscription')
                        .setDescription('Un même joueur ne peut pas être ajouté plusieurs fois.')
                        .setTimestamp()]
                });
            }

            // Préparer les données des joueurs pour l'API
            const playersData = players.map(player => ({
                name: player.globalName || player.username,
                discord: player.username,
                discord_id: player.id
            }));

            // Appeler l'API pour inscrire l'équipe
            const response = await fetch(`${config.apiUrl}/teams/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'SBL-Discord-Bot',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    name: teamName,
                    captain_discord_id: captain.id,
                    players: playersData
                }),
                signal: AbortSignal.timeout(15000)
            });

            const data = await response.json();

            if (!response.ok) {
                let errorMessage = data.error || 'Erreur inconnue';

                // Messages d'erreur plus explicites
                if (errorMessage.includes('linked Discord account')) {
                    errorMessage = `Le capitaine <@${captain.id}> n'a pas de compte Discord lié. Il doit d'abord se connecter sur le site web avec Discord.`;
                } else if (errorMessage.includes('No current or upcoming season')) {
                    errorMessage = 'Aucune saison en cours ou à venir n\'est disponible pour les inscriptions.';
                }

                return await interaction.editReply({
                    embeds: [new EmbedBuilder()
                        .setColor(0xFF0000)
                        .setTitle('❌ Erreur - Inscription')
                        .setDescription(errorMessage)
                        .setTimestamp()]
                });
            }

            // Créer l'embed de succès
            const embed = new EmbedBuilder()
                .setColor(0x00FF00)
                .setTitle('✅ Équipe inscrite avec succès!')
                .addFields(
                    {
                        name: '🏷️ Équipe',
                        value: data.team.name,
                        inline: true
                    },
                    {
                        name: '👑 Capitaine',
                        value: `<@${captain.id}>`,
                        inline: true
                    },
                    {
                        name: '📅 Saison',
                        value: data.season.name,
                        inline: true
                    }
                )
                .setTimestamp();

            // Ajouter la liste des joueurs
            const playersList = data.players.map((p, i) => `${i + 1}. **${p.name}** (${p.discord || 'Discord non renseigné'})`).join('\n');
            embed.addFields({
                name: `👥 Joueurs (${data.players.length})`,
                value: playersList,
                inline: false
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Erreur lors de l\'inscription:', error);

            let errorMessage = 'Erreur de connexion à l\'API';
            if (error.name === 'TimeoutError') {
                errorMessage = 'Timeout - L\'API ne répond pas';
            } else if (error.message) {
                errorMessage = error.message;
            }

            await interaction.editReply({
                embeds: [new EmbedBuilder()
                    .setColor(0xFF0000)
                    .setTitle('❌ Erreur - Inscription')
                    .setDescription(errorMessage)
                    .setTimestamp()]
            });
        }
    },
};
