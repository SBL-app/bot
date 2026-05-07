const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { API_URL } = require('../apiConfig');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('matchs')
        .setDescription('Affiche les matchs d\'une division spécifique')
        .addIntegerOption(option =>
            option.setName('division')
                .setDescription('ID de la division pour laquelle récupérer les matchs')
                .setRequired(true)
                .setMinValue(1))
        .addIntegerOption(option =>
            option.setName('page')
                .setDescription('Numéro de page à afficher (optionnel)')
                .setRequired(false)
                .setMinValue(1)),
    
    async execute(interaction) {
        // Répondre immédiatement pour éviter le timeout seulement si ce n'est pas déjà fait
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'Récupération des matchs...', ephemeral: true });
        }
        
        try {
            const divisionId = interaction.options.getInteger('division');
            const pageParam = interaction.options.getInteger('page') || 1;
            const weeksPerPage = 2; // Nombre de semaines par page
            
            const apiUrl = `${API_URL}/games?division_id=${divisionId}`;
            const startTime = Date.now();
            
            // Effectuer la requête vers l'API
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'User-Agent': 'SBL-Discord-Bot',
                    'Accept': 'application/json'
                },
                // Timeout de 15 secondes
                signal: AbortSignal.timeout(15000)
            });
            
            const responseTime = Date.now() - startTime;
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Aucun match trouvé pour la division ${divisionId}`);
                }
                throw new Error(`Erreur API: ${response.status} ${response.statusText}`);
            }
            
            const games = await response.json();
            
            if (!Array.isArray(games)) {
                throw new Error('Format de données non reconnu de l\'API');
            }
            
            if (games.length === 0) {
                const emptyEmbed = new EmbedBuilder()
                    .setColor(0xFFA500)
                    .setTitle(`⚽ Matchs - Division ${divisionId}`)
                    .setDescription('Aucun match trouvé pour cette division')
                    .setTimestamp()
                    .setFooter({ text: `Récupéré en ${responseTime}ms` });
                
                // Bouton pour retourner aux détails de la division
                const components = [];
                const actionRow = new ActionRowBuilder();
                
                actionRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`division_details_${divisionId}`)
                        .setLabel('Retour à la division')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🏆')
                );
                
                components.push(actionRow);
                
                await interaction.editReply({ 
                    content: null, 
                    embeds: [emptyEmbed],
                    components: components
                });
                return;
            }
            
            // Regrouper les matchs par semaine
            const gamesByWeek = {};
            games.forEach(game => {
                if (!gamesByWeek[game.week]) {
                    gamesByWeek[game.week] = [];
                }
                gamesByWeek[game.week].push(game);
            });
            
            // Trier chaque semaine par date
            Object.keys(gamesByWeek).forEach(week => {
                gamesByWeek[week].sort((a, b) => new Date(a.date) - new Date(b.date));
            });
            
            // Calculer la pagination par semaines
            const weeks = Object.keys(gamesByWeek).sort((a, b) => parseInt(a) - parseInt(b));
            const totalPages = Math.ceil(weeks.length / weeksPerPage);
            const currentPage = Math.min(pageParam, totalPages);
            const startIndex = (currentPage - 1) * weeksPerPage;
            const endIndex = Math.min(startIndex + weeksPerPage, weeks.length);
            const weeksToShow = weeks.slice(startIndex, endIndex);
            
            // Créer l'embed principal
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle(`⚽ Matchs - ${games[0].division || `Division ${divisionId}`}`)
                .setDescription(`**${games.length}** match(s) trouvé(s) sur **${weeks.length}** semaine(s) | Page **${currentPage}**/**${totalPages}**`)
                .setTimestamp()
                .setFooter({ text: `Récupéré en ${responseTime}ms` });
            
            // Calculer les statistiques générales
            const finishedGames = games.filter(game => game.status === 'joué').length;
            const pendingGames = games.length - finishedGames;
            
            let statsText = `📊 **Matchs terminés:** ${finishedGames}/${games.length}\n`;
            if (pendingGames > 0) {
                statsText += `⏳ **Matchs à venir:** ${pendingGames}\n`;
            }
            statsText += `📅 **Semaines totales:** ${weeks.length} (${weeks.join(', ')})`;
            
            embed.addFields({
                name: '📈 Statistiques',
                value: statsText,
                inline: false
            });
            
            // Afficher les matchs par semaine
            weeksToShow.forEach(week => {
                const weekGames = gamesByWeek[week];
                let weekContent = '';
                
                weekGames.forEach(game => {
                    const team1Icon = getTeamStatusIcon(game.winner, 1);
                    const team2Icon = getTeamStatusIcon(game.winner, 2);
                    
                    if (game.status === 'joué' && game.score1 !== undefined && game.score2 !== undefined) {
                        weekContent += `${team1Icon} **${game.team1}** ${game.score1} - ${game.score2} **${game.team2}** ${team2Icon}\n`;
                        weekContent += `📅 ${formatDate(game.date)} | id match ${game.id}\n\n`;
                    } else {
                        weekContent += `⚽ **${game.team1}** vs **${game.team2}**\n`;
                        weekContent += `📅 ${formatDate(game.date)} | id match ${game.id} | 📊 ${game.status || 'Non défini'}\n\n`;
                    }
                });
                
                // Calculer les statistiques de la semaine
                const weekFinished = weekGames.filter(g => g.status === 'joué').length;
                const weekTotal = weekGames.length;
                
                // Limiter la longueur pour éviter les erreurs Discord
                if (weekContent.length > 900) {
                    weekContent = weekContent.substring(0, 896) + '...\n';
                }
                
                weekContent += `📊 **${weekFinished}/${weekTotal}** matchs terminés`;
                
                embed.addFields({
                    name: `📅 Semaine ${week}`,
                    value: weekContent || 'Aucun match',
                    inline: false
                });
            });
            
            // Créer les boutons de navigation
            const components = [];
            
            // Première rangée : Navigation de pages
            if (totalPages > 1) {
                const paginationRow = new ActionRowBuilder();
                
                // Bouton page précédente
                if (currentPage > 1) {
                    paginationRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`matchs_division_${divisionId}_page_${currentPage - 1}`)
                            .setLabel('⬅️ Précédent')
                            .setStyle(ButtonStyle.Primary)
                    );
                }
                
                // Bouton informations de page
                paginationRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId('matchs_page_info')
                        .setLabel(`Page ${currentPage}/${totalPages}`)
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );
                
                // Bouton page suivante
                if (currentPage < totalPages) {
                    paginationRow.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`matchs_division_${divisionId}_page_${currentPage + 1}`)
                            .setLabel('Suivant ➡️')
                            .setStyle(ButtonStyle.Primary)
                    );
                }
                
                components.push(paginationRow);
            }
            
            // Deuxième rangée : Navigation générale
            const navigationRow = new ActionRowBuilder();
            
            // Bouton pour retourner aux détails de la division
            navigationRow.addComponents(
                new ButtonBuilder()
                    .setCustomId(`division_details_${divisionId}`)
                    .setLabel('Retour à la division')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('🏆')
            );
            
            // Bouton pour retourner à la liste des saisons
            navigationRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('back_to_seasons')
                    .setLabel('Toutes les saisons')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📅')
            );
            
            components.push(navigationRow);
            
            await interaction.editReply({ 
                content: null, 
                embeds: [embed],
                components: components
            });
            
        } catch (error) {
            let errorMessage = 'Erreur inconnue';
            
            if (error.name === 'TimeoutError') {
                errorMessage = 'Timeout - L\'API ne répond pas dans les temps';
            } else if (error.code === 'ENOTFOUND') {
                errorMessage = 'Impossible de résoudre le nom de domaine';
            } else if (error.code === 'ECONNREFUSED') {
                errorMessage = 'Connexion refusée par le serveur';
            } else if (error.message.includes('404') || error.message.includes('Aucun match')) {
                errorMessage = error.message;
            } else if (error.message.includes('500')) {
                errorMessage = 'Erreur interne du serveur API';
            } else {
                errorMessage = error.message || 'Erreur de connexion à l\'API';
            }
            
            const errorEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('❌ Erreur - Matchs')
                .addFields(
                    { name: 'Erreur', value: errorMessage, inline: false },
                    { name: 'URL tentée', value: `${API_URL}/games/${interaction.options.getInteger('division')}`, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'Récupération échouée' });
            
            await interaction.editReply({ content: null, embeds: [errorEmbed] });
        }
    },
};

// Fonction utilitaire pour formater la date
function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        };
        return date.toLocaleDateString('fr-FR', options);
    } catch (error) {
        return dateString; // Retourner la date originale si le parsing échoue
    }
}

// Fonction utilitaire pour obtenir l'icône de statut de l'équipe
function getTeamStatusIcon(winner, teamNumber) {
    if (winner === teamNumber) {
        return '🏆'; // Vainqueur
    } else if (winner === 0 || winner === null || winner === undefined) {
        return '🤝'; // Match nul ou pas encore joué
    } else {
        return '💔'; // Perdant
    }
}
