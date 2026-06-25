import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import config from './config.json' with { type: "json" };

const { token, applicationId } = config;

// Obtenir __dirname dans un module ES6
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const commands = [];

// Fonction pour charger les commandes
async function loadCommands() {
    // Charger les commandes depuis le dossier commands
    const commandsPath = join(__dirname, 'commands');
    const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = join(commandsPath, file);
        const command = await import(filePath);
        
        if ('data' in command && 'execute' in command) {
            commands.push(command.data.toJSON());
        } else {
            console.log(`[ATTENTION] La commande dans ${filePath} manque d'une propriété "data" ou "execute" requise.`);
        }
    }
}

// Déployer les commandes
async function deployCommands() {
    await loadCommands();
    
    const rest = new REST({ version: '10' }).setToken(token);

    try {
        console.log(`Début du déploiement de ${commands.length} commandes slash...`);

        // Déployer les commandes globalement
        const data = await rest.put(
            Routes.applicationCommands(applicationId),
            { body: commands },
        );

        console.log(`${data.length} commandes slash déployées avec succès!`);
    } catch (error) {
        console.error('Erreur lors du déploiement des commandes:', error);
    }
}

// Exécuter le déploiement
deployCommands();
