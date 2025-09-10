import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import { ApiClient, ApiError } from '../utils/apiClient';

export const data = new SlashCommandBuilder()
    .setName('teams')
    .setDescription('Affiche la liste de toutes les équipes')
    .addIntegerOption(option => option.setName('page')
        .setDescription('Numéro de page à afficher (optionnel)')
        .setRequired(false)
        .setMinValue(1));
export async function execute(interaction) {
    // Répondre immédiatement pour éviter le timeout
    if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: 'Récupération des équipes...', ephemeral: true });
    }

    try {
        const pageParam = interaction.options.getInteger('page') || 1;
        const teamsPerPage = 10; // Nombre d'équipes par page

        const apiClient = new ApiClient();
        const result = await apiClient.getTeams();
        const teams = result.data;
        const responseTime = result.responseTime;

        if (!Array.isArray(teams)) {
            throw new Error('Format de données non reconnu de l\'API');
        }

        if (teams.length === 0) {
            const emptyEmbed = new EmbedBuilder()
                .setColor(0xFFA500)
                .setTitle('👥 Équipes')
                .setDescription('Aucune équipe trouvée')
                .setTimestamp()
                .setFooter({ text: `Récupéré en ${responseTime}ms` });

            await interaction.editReply({ content: null, embeds: [emptyEmbed] });
            return;
        }

        // Calculer la pagination
        const totalPages = Math.ceil(teams.length / teamsPerPage);
        const currentPage = Math.min(pageParam, totalPages);
        const startIndex = (currentPage - 1) * teamsPerPage;
        const endIndex = Math.min(startIndex + teamsPerPage, teams.length);
        const teamsToShow = teams.slice(startIndex, endIndex);

        // Créer l'embed principal
        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('👥 Liste des équipes')
            .setDescription(`**${teams.length}** équipe(s) trouvée(s) | Page **${currentPage}**/**${totalPages}**`)
            .setTimestamp()
            .setFooter({ text: `Récupéré en ${responseTime}ms` });

        // Afficher les équipes de la page courante
        let teamsContent = '';
        teamsToShow.forEach((team, index) => {
            const globalIndex = startIndex + index + 1;
            teamsContent += `**${globalIndex}.** `;

            // Nom de l'équipe
            if (team.name) {
                teamsContent += `**${team.name}**`;
            } else {
                teamsContent += `**Équipe ${team.id || 'Inconnue'}**`;
            }

            // ID de l'équipe
            if (team.id) {
                teamsContent += ` (ID: ${team.id})`;
            }

            // Informations supplémentaires selon les données disponibles
            let extraInfo = [];

            if (team.wins !== undefined && team.losses !== undefined) {
                extraInfo.push(`${team.wins}V/${team.losses}D`);
            }

            if (team.points !== undefined) {
                extraInfo.push(`${team.points} pts`);
            }

            if (team.division) {
                extraInfo.push(`Division: ${team.division}`);
            }

            if (team.season) {
                extraInfo.push(`Saison: ${team.season}`);
            }

            if (team.captain) {
                extraInfo.push(`Capitaine: ${team.captain}`);
            }

            if (team.founded) {
                extraInfo.push(`Fondée: ${team.founded}`);
            }

            if (team.description && team.description.length <= 50) {
                extraInfo.push(`${team.description}`);
            }

            if (extraInfo.length > 0) {
                teamsContent += `\n   📊 ${extraInfo.join(' | ')}`;
            }

            teamsContent += '\n\n';
        });

        // Limiter la longueur pour éviter les erreurs Discord
        if (teamsContent.length > 4000) {
            teamsContent = teamsContent.substring(0, 3950) + '\n... (contenu tronqué)';
        }

        embed.addFields({
            name: `📋 Équipes ${startIndex + 1}-${endIndex}`,
            value: teamsContent || 'Aucune équipe à afficher',
            inline: false
        });

        // Ajouter des statistiques générales
        const statsText = [
            `📊 **Total:** ${teams.length} équipes`,
            `📄 **Pages:** ${totalPages}`,
            `📍 **Page actuelle:** ${currentPage}`
        ].join('\n');

        embed.addFields({
            name: '📈 Statistiques',
            value: statsText,
            inline: false
        });

        // Ajouter une indication pour la navigation vers les détails
        if (teamsToShow.length > 0) {
            embed.addFields({
                name: '💡 Navigation',
                value: 'Utilisez les boutons verts ci-dessous pour voir les détails d\'une équipe spécifique, ou utilisez `/team id:<id>` directement.',
                inline: false
            });
        }

        // Créer les boutons de navigation
        const components = [];

        // Première rangée : Navigation de pages
        if (totalPages > 1) {
            const paginationRow = new ActionRowBuilder();

            // Bouton page précédente
            if (currentPage > 1) {
                paginationRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`teams_page_${currentPage - 1}`)
                        .setLabel('⬅️ Précédent')
                        .setStyle(ButtonStyle.Primary)
                );
            }

            // Bouton informations de page
            paginationRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('teams_page_info')
                    .setLabel(`Page ${currentPage}/${totalPages}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );

            // Bouton page suivante
            if (currentPage < totalPages) {
                paginationRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`teams_page_${currentPage + 1}`)
                        .setLabel('Suivant ➡️')
                        .setStyle(ButtonStyle.Primary)
                );
            }

            // Bouton première page (si pas sur la première)
            if (currentPage > 2) {
                paginationRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId('teams_page_1')
                        .setLabel('⏮️ Première')
                        .setStyle(ButtonStyle.Secondary)
                );
            }

            // Bouton dernière page (si pas sur la dernière)
            if (currentPage < totalPages - 1) {
                paginationRow.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`teams_page_${totalPages}`)
                        .setLabel('Dernière ⏭️')
                        .setStyle(ButtonStyle.Secondary)
                );
            }

            components.push(paginationRow);
        }

        // Deuxième rangée : Navigation générale
        const navigationRow = new ActionRowBuilder();

        // Bouton pour retourner à la liste des saisons
        navigationRow.addComponents(
            new ButtonBuilder()
                .setCustomId('back_to_seasons')
                .setLabel('Toutes les saisons')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📅')
        );

        // Bouton pour actualiser
        navigationRow.addComponents(
            new ButtonBuilder()
                .setCustomId(`teams_page_${currentPage}`)
                .setLabel('🔄 Actualiser')
                .setStyle(ButtonStyle.Secondary)
        );

        components.push(navigationRow);

        // Troisième rangée : Menu déroulant pour accéder aux détails des équipes
        if (teamsToShow.length > 0) {
            const selectMenuRow = new ActionRowBuilder();

            // Créer les options pour le menu déroulant
            const selectOptions = [];

            teamsToShow.forEach(team => {
                if (team.id) {
                    // Créer une description pour l'option
                    let description = '';
                    const extraInfo = [];

                    if (team.wins !== undefined && team.losses !== undefined) {
                        extraInfo.push(`${team.wins}V/${team.losses}D`);
                    }

                    if (team.points !== undefined) {
                        extraInfo.push(`${team.points} pts`);
                    }

                    if (team.division) {
                        extraInfo.push(`Div: ${team.division}`);
                    }

                    if (extraInfo.length > 0) {
                        description = extraInfo.join(' | ');
                        // Limiter la longueur de la description (max 100 caractères pour Discord)
                        if (description.length > 100) {
                            description = description.substring(0, 97) + '...';
                        }
                    } else {
                        description = `ID: ${team.id}`;
                    }

                    // Créer le label (max 100 caractères pour Discord)
                    let label = team.name || `Équipe ${team.id}`;
                    if (label.length > 100) {
                        label = label.substring(0, 97) + '...';
                    }

                    selectOptions.push(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(label)
                            .setDescription(description)
                            .setValue(`team_details_${team.id}`)
                            .setEmoji('👥')
                    );
                }
            });

            // Créer le menu déroulant (max 25 options par menu)
            if (selectOptions.length > 0) {
                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('team_select_menu')
                    .setPlaceholder('� Sélectionnez une équipe pour voir ses détails...')
                    .setMinValues(1)
                    .setMaxValues(1)
                    .addOptions(selectOptions.slice(0, 25)); // Discord limite à 25 options max

                selectMenuRow.addComponents(selectMenu);
                components.push(selectMenuRow);

                // Si plus de 25 équipes, ajouter une note
                if (selectOptions.length > 25) {
                    embed.addFields({
                        name: '⚠️ Information',
                        value: `Seules les 25 premières équipes sont affichées dans le menu déroulant. Utilisez la pagination pour voir les autres équipes.`,
                        inline: false
                    });
                }
            }
        }
        await interaction.editReply({
            content: null,
            embeds: [embed],
            components: components
        });

    } catch (error) {
        let errorMessage = 'Erreur inconnue';

        if (error instanceof ApiError) {
            if (error.isNotFound()) {
                errorMessage = 'Aucune équipe trouvée';
            } else if (error.isTimeout()) {
                errorMessage = 'Timeout - L\'API ne répond pas dans les temps';
            } else if (error.isServerError()) {
                errorMessage = 'Erreur interne du serveur API';
            } else {
                errorMessage = `Erreur API: ${error.status} ${error.message}`;
            }
        } else if (error.name === 'TimeoutError') {
            errorMessage = 'Timeout - L\'API ne répond pas dans les temps';
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = 'Impossible de résoudre le nom de domaine';
        } else if (error.code === 'ECONNREFUSED') {
            errorMessage = 'Connexion refusée par le serveur';
        } else {
            errorMessage = error.message || 'Erreur de connexion à l\'API';
        }

        const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ Erreur - Équipes')
            .addFields(
                { name: 'Erreur', value: errorMessage, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Récupération échouée' });

        await interaction.editReply({ content: null, embeds: [errorEmbed] });
    }
}
