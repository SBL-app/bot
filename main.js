const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

// Créer une nouvelle instance du client Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

// Collection pour stocker les commandes
client.commands = new Collection();
const commands = [];

// Charger les commandes depuis le dossier commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
        console.log(`Commande ${command.data.name} chargée.`);
    } else {
        console.log(`[ATTENTION] La commande dans ${filePath} manque d'une propriété "data" ou "execute" requise.`);
    }
}

// Event: Bot prêt
client.once('ready', async () => {
    console.log(`Bot connecté en tant que ${client.user.tag}!`);
    
    // Enregistrer les slash commands
    const rest = new REST({ version: '10' }).setToken(config.token);
    
    try {
        console.log('Début de l\'actualisation des commandes slash...');
        
        await rest.put(
            Routes.applicationCommands(config.applicationId),
            { body: commands }
        );
        
        console.log('Commandes slash actualisées avec succès!');
    } catch (error) {
        console.error('Erreur lors de l\'actualisation des commandes:', error);
    }
});

// Event: Interaction avec les commandes slash et boutons
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        
        if (!command) {
            console.error(`Aucune commande correspondante trouvée pour ${interaction.commandName}.`);
            return;
        }
        
        try {
            await command.execute(interaction);
        } catch (error) {
            console.error('Erreur lors de l\'exécution de la commande:', error);
            
            const errorMessage = { content: 'Une erreur s\'est produite lors de l\'exécution de cette commande!', ephemeral: true };
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        }
    } else if (interaction.isButton()) {
        // Acquitter immédiatement l'interaction pour éviter les timeouts
        if (!interaction.replied && !interaction.deferred) {
            await interaction.deferUpdate();
        }
        
        // Gestion des boutons de pagination des saisons
        if (interaction.customId.startsWith('seasons_page_')) {
            const pageNumber = parseInt(interaction.customId.replace('seasons_page_', ''));
            
            if (isNaN(pageNumber)) {
                await interaction.editReply({ content: 'Numéro de page invalide.', components: [], embeds: [] });
                return;
            }
            
            // Récupérer la commande saisons et l'exécuter avec la nouvelle page
            const seasonsCommand = client.commands.get('saisons');
            if (seasonsCommand) {
                // Créer une fausse interaction avec la page demandée
                const fakeOptions = {
                    getInteger: (name) => name === 'page' ? pageNumber : null
                };
                
                const fakeInteraction = {
                    ...interaction,
                    options: fakeOptions,
                    reply: async (options) => await interaction.editReply(options),
                    editReply: async (options) => await interaction.editReply(options)
                };
                
                try {
                    await seasonsCommand.execute(fakeInteraction);
                } catch (error) {
                    console.error('Erreur lors de la pagination des saisons:', error);
                    await interaction.editReply({ 
                        content: 'Erreur lors du changement de page.', 
                        components: [],
                        embeds: []
                    });
                }
            }
        }
        // Gestion des boutons de pagination des équipes
        else if (interaction.customId.startsWith('teams_page_')) {
            const pageNumber = parseInt(interaction.customId.replace('teams_page_', ''));
            
            if (isNaN(pageNumber)) {
                await interaction.editReply({ content: 'Numéro de page invalide.', components: [], embeds: [] });
                return;
            }
            
            // Récupérer la commande teams et l'exécuter avec la nouvelle page
            const teamsCommand = client.commands.get('teams');
            if (teamsCommand) {
                // Créer une fausse interaction avec la page demandée
                const fakeOptions = {
                    getInteger: (name) => name === 'page' ? pageNumber : null
                };
                
                const fakeInteraction = {
                    ...interaction,
                    options: fakeOptions,
                    reply: async (options) => await interaction.editReply(options),
                    editReply: async (options) => await interaction.editReply(options)
                };
                
                try {
                    await teamsCommand.execute(fakeInteraction);
                } catch (error) {
                    console.error('Erreur lors de la pagination des équipes:', error);
                    await interaction.editReply({ 
                        content: 'Erreur lors du changement de page des équipes.', 
                        components: [],
                        embeds: []
                    });
                }
            }
        }
        // Gestion des boutons pour voir les détails d'une saison
        else if (interaction.customId.startsWith('season_details_')) {
            const seasonId = parseInt(interaction.customId.replace('season_details_', ''));
            
            if (isNaN(seasonId)) {
                await interaction.editReply({ content: 'ID de saison invalide.', components: [], embeds: [] });
                return;
            }
            
            // Récupérer la commande saison et l'exécuter avec l'ID demandé
            const seasonCommand = client.commands.get('saison');
            if (seasonCommand) {
                // Créer une fausse interaction avec l'ID de saison demandé
                const fakeOptions = {
                    getInteger: (name) => name === 'id' ? seasonId : null
                };
                
                const fakeInteraction = {
                    ...interaction,
                    options: fakeOptions,
                    reply: async (options) => await interaction.editReply(options),
                    editReply: async (options) => await interaction.editReply(options)
                };
                
                try {
                    await seasonCommand.execute(fakeInteraction);
                } catch (error) {
                    console.error('Erreur lors de l\'affichage des détails de la saison:', error);
                    await interaction.editReply({ 
                        content: 'Erreur lors de la récupération des détails de la saison.', 
                        components: [],
                        embeds: []
                    });
                }
            }
        }
        // Gestion du bouton pour voir les divisions d'une saison
        else if (interaction.customId.startsWith('divisions_season_')) {
            const seasonId = parseInt(interaction.customId.replace('divisions_season_', ''));
            
            if (isNaN(seasonId)) {
                await interaction.editReply({ content: 'ID de saison invalide.', components: [], embeds: [] });
                return;
            }
            
            // Récupérer la commande divisions et l'exécuter avec l'ID de saison demandé
            const divisionsCommand = client.commands.get('divisions');
            if (divisionsCommand) {
                // Créer une fausse interaction avec l'ID de saison demandé
                const fakeOptions = {
                    getInteger: (name) => name === 'saison' ? seasonId : null
                };
                
                const fakeInteraction = {
                    ...interaction,
                    options: fakeOptions,
                    reply: async (options) => await interaction.editReply(options),
                    editReply: async (options) => await interaction.editReply(options)
                };
                
                try {
                    await divisionsCommand.execute(fakeInteraction);
                } catch (error) {
                    console.error('Erreur lors de l\'affichage des divisions:', error);
                    await interaction.editReply({ 
                        content: 'Erreur lors de la récupération des divisions.', 
                        components: [],
                        embeds: []
                    });
                }
            }
        }
        // Gestion des boutons pour voir les détails d'une division
        else if (interaction.customId.startsWith('division_details_')) {
            const divisionId = parseInt(interaction.customId.replace('division_details_', ''));
            
            if (isNaN(divisionId)) {
                await interaction.editReply({ content: 'ID de division invalide.', components: [], embeds: [] });
                return;
            }
            
            // Récupérer la commande division et l'exécuter avec l'ID demandé
            const divisionCommand = client.commands.get('division');
            if (divisionCommand) {
                // Créer une fausse interaction avec l'ID de division demandé
                const fakeOptions = {
                    getInteger: (name) => name === 'id' ? divisionId : null
                };
                
                const fakeInteraction = {
                    ...interaction,
                    options: fakeOptions,
                    reply: async (options) => await interaction.editReply(options),
                    editReply: async (options) => await interaction.editReply(options)
                };
                
                try {
                    await divisionCommand.execute(fakeInteraction);
                } catch (error) {
                    console.error('Erreur lors de l\'affichage des détails de la division:', error);
                    await interaction.editReply({ 
                        content: 'Erreur lors de la récupération des détails de la division.', 
                        components: [],
                        embeds: []
                    });
                }
            }
        }
        // Gestion des boutons pour voir les matchs d'une division avec pagination
        else if (interaction.customId.startsWith('matchs_division_')) {
            // Format: matchs_division_{divisionId}_page_{pageNumber}
            const match = interaction.customId.match(/^matchs_division_(\d+)_page_(\d+)$/);
            
            if (!match) {
                await interaction.editReply({ content: 'Format de bouton invalide.', components: [], embeds: [] });
                return;
            }
            
            const divisionId = parseInt(match[1]);
            const pageNumber = parseInt(match[2]);
            
            if (isNaN(divisionId) || isNaN(pageNumber)) {
                await interaction.editReply({ content: 'Paramètres invalides.', components: [], embeds: [] });
                return;
            }
            
            // Récupérer la commande matchs et l'exécuter avec les paramètres demandés
            const matchsCommand = client.commands.get('matchs');
            if (matchsCommand) {
                // Créer une fausse interaction avec les paramètres demandés
                const fakeOptions = {
                    getInteger: (name) => {
                        if (name === 'division') return divisionId;
                        if (name === 'page') return pageNumber;
                        return null;
                    }
                };
                
                const fakeInteraction = {
                    ...interaction,
                    options: fakeOptions,
                    reply: async (options) => await interaction.editReply(options),
                    editReply: async (options) => await interaction.editReply(options)
                };
                
                try {
                    await matchsCommand.execute(fakeInteraction);
                } catch (error) {
                    console.error('Erreur lors de la pagination des matchs:', error);
                    await interaction.editReply({ 
                        content: 'Erreur lors du changement de page des matchs.', 
                        components: [],
                        embeds: []
                    });
                }
            }
        }
        // Gestion des boutons de pagination des matchs
        else if (interaction.customId.startsWith('matchs_page_')) {
            // Format: matchs_page_{divisionId}_{pageNumber}
            const match = interaction.customId.match(/^matchs_page_(\d+)_(\d+)$/);
            
            if (!match) {
                await interaction.editReply({ content: 'Format de bouton invalide.', components: [], embeds: [] });
                return;
            }
            
            const divisionId = parseInt(match[1]);
            const pageNumber = parseInt(match[2]);
            
            if (isNaN(divisionId) || isNaN(pageNumber)) {
                await interaction.editReply({ content: 'Paramètres invalides.', components: [], embeds: [] });
                return;
            }
            
            // Récupérer la commande matchs et l'exécuter avec les paramètres demandés
            const matchsCommand = client.commands.get('matchs');
            if (matchsCommand) {
                // Créer une fausse interaction avec les paramètres demandés
                const fakeOptions = {
                    getInteger: (name) => {
                        if (name === 'division') return divisionId;
                        if (name === 'page') return pageNumber;
                        return null;
                    }
                };
                
                const fakeInteraction = {
                    ...interaction,
                    options: fakeOptions,
                    reply: async (options) => await interaction.editReply(options),
                    editReply: async (options) => await interaction.editReply(options)
                };
                
                try {
                    await matchsCommand.execute(fakeInteraction);
                } catch (error) {
                    console.error('Erreur lors de la pagination des matchs:', error);
                    await interaction.editReply({ 
                        content: 'Erreur lors du changement de page des matchs.', 
                        components: [],
                        embeds: []
                    });
                }
            }
        }
        // Gestion du bouton pour retourner à la liste des saisons
        else if (interaction.customId === 'back_to_seasons') {
            // Récupérer la commande saisons et l'exécuter
            const seasonsCommand = client.commands.get('saisons');
            if (seasonsCommand) {
                // Créer une fausse interaction sans options spéciales
                const fakeOptions = {
                    getInteger: (name) => null
                };
                
                const fakeInteraction = {
                    ...interaction,
                    options: fakeOptions,
                    reply: async (options) => await interaction.editReply(options),
                    editReply: async (options) => await interaction.editReply(options)
                };
                
                try {
                    await seasonsCommand.execute(fakeInteraction);
                } catch (error) {
                    console.error('Erreur lors du retour aux saisons:', error);
                    await interaction.editReply({ 
                        content: 'Erreur lors du retour à la liste des saisons.', 
                        components: [],
                        embeds: []
                    });
                }
            }
        }
        // Gestion des boutons pour voir les détails d'une équipe
        else if (interaction.customId.startsWith('team_details_')) {
            const teamId = parseInt(interaction.customId.replace('team_details_', ''));
            
            if (isNaN(teamId)) {
                await interaction.editReply({ content: 'ID d\'équipe invalide.', components: [], embeds: [] });
                return;
            }
            
            // Récupérer la commande team et l'exécuter avec l'ID demandé
            const teamCommand = client.commands.get('team');
            if (teamCommand) {
                // Créer une fausse interaction avec l'ID d'équipe demandé
                const fakeOptions = {
                    getInteger: (name) => name === 'id' ? teamId : null
                };
                
                const fakeInteraction = {
                    ...interaction,
                    options: fakeOptions,
                    reply: async (options) => await interaction.editReply(options),
                    editReply: async (options) => await interaction.editReply(options)
                };
                
                try {
                    await teamCommand.execute(fakeInteraction);
                } catch (error) {
                    console.error('Erreur lors de l\'affichage des détails de l\'équipe:', error);
                    await interaction.editReply({ 
                        content: 'Erreur lors de la récupération des détails de l\'équipe.', 
                        components: [],
                        embeds: []
                    });
                }
            }
        }
        // Gestion par défaut pour les boutons non reconnus
        else {
            console.log(`Bouton non reconnu: ${interaction.customId}`);
            await interaction.editReply({ 
                content: 'Bouton non reconnu ou non implémenté.', 
                components: [],
                embeds: []
            });
        }
    } else if (interaction.isStringSelectMenu()) {
        // Acquitter immédiatement l'interaction pour éviter les timeouts
        if (!interaction.replied && !interaction.deferred) {
            await interaction.deferUpdate();
        }
        
        // Gestion du menu déroulant pour les équipes
        if (interaction.customId === 'team_select_menu') {
            const selectedValue = interaction.values[0];
            
            // Vérifier que la sélection correspond au format attendu
            if (selectedValue.startsWith('team_details_')) {
                const teamId = parseInt(selectedValue.replace('team_details_', ''));
                
                if (isNaN(teamId)) {
                    await interaction.editReply({ content: 'ID d\'équipe invalide.', components: [], embeds: [] });
                    return;
                }
                
                // Récupérer la commande team et l'exécuter avec l'ID demandé
                const teamCommand = client.commands.get('team');
                if (teamCommand) {
                    // Créer une fausse interaction avec l'ID d'équipe demandé
                    const fakeOptions = {
                        getInteger: (name) => name === 'id' ? teamId : null
                    };
                    
                    const fakeInteraction = {
                        ...interaction,
                        options: fakeOptions,
                        reply: async (options) => await interaction.editReply(options),
                        editReply: async (options) => await interaction.editReply(options)
                    };
                    
                    try {
                        await teamCommand.execute(fakeInteraction);
                    } catch (error) {
                        console.error('Erreur lors de l\'affichage des détails de l\'équipe:', error);
                        await interaction.editReply({ 
                            content: 'Erreur lors de la récupération des détails de l\'équipe.', 
                            components: [],
                            embeds: []
                        });
                    }
                } else {
                    await interaction.editReply({ 
                        content: 'Commande team non trouvée.', 
                        components: [],
                        embeds: []
                    });
                }
            } else {
                await interaction.editReply({ 
                    content: 'Sélection invalide.', 
                    components: [],
                    embeds: []
                });
            }
        }
        // Gestion par défaut pour les menus déroulants non reconnus
        else {
            console.log(`Menu déroulant non reconnu: ${interaction.customId}`);
            await interaction.editReply({ 
                content: 'Menu déroulant non reconnu ou non implémenté.', 
                components: [],
                embeds: []
            });
        }
    }
});

// Event: Gestion des erreurs
client.on('error', (error) => {
    console.error('Erreur du client Discord:', error);
});

// Connexion du bot
client.login(config.token);
