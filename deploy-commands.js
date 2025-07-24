const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');

const commands = [];

// Charger les commandes depuis le dossier commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    } else {
        console.log(`[ATTENTION] La commande dans ${filePath} manque d'une propriété "data" ou "execute" requise.`);
    }
}

// Déployer les commandes
const rest = new REST({ version: '10' }).setToken(config.token);

(async () => {
    try {
        console.log(`Début du déploiement de ${commands.length} commandes slash...`);

        // Déployer les commandes globalement
        const data = await rest.put(
            Routes.applicationCommands(config.applicationId),
            { body: commands },
        );

        console.log(`${data.length} commandes slash déployées avec succès!`);
    } catch (error) {
        console.error('Erreur lors du déploiement des commandes:', error);
    }
})();
