# SBL Bot Discord

Bot Discord utilisant les slash commands pour SBL.

## Installation

1. Clonez le projet
2. Installez les dépendances :
   ```bash
   npm install
   ```

3. Configurez le fichier `config.json` avec :
   - `token` : Le token de votre bot Discord
   - `applicationId` : L'ID de votre application Discord
   - `apiUrl` : L'URL de votre API

## Utilisation

### Déployer les commandes
Avant de lancer le bot pour la première fois, déployez les commandes slash :
```bash
npm run deploy
```

### Lancer le bot
```bash
npm start
```

### Mode développement (avec auto-restart)
```bash
npm run dev
```

## Structure du projet

```
├── main.js              # Fichier principal du bot
├── deploy-commands.js   # Script de déploiement des commandes
├── config.json         # Configuration (token, etc.)
├── commands/           # Dossier contenant toutes les commandes
│   ├── apistatus.js    # Commande de vérification de l'API
│   └── serverinfo.js   # Commande d'info serveur
└── package.json        # Dépendances et scripts
```

## Ajouter une nouvelle commande

1. Créez un nouveau fichier dans le dossier `commands/`
2. Utilisez ce template :

```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nom-commande')
        .setDescription('Description de la commande'),
    
    async execute(interaction) {
        await interaction.reply('Réponse de la commande');
    },
};
```

3. Redéployez les commandes avec `npm run deploy`
4. Redémarrez le bot

## Commandes disponibles

- `/apistatus` - Vérifie l'état de l'API SBL
- `/serverinfo` - Affiche les informations du serveur Discord
