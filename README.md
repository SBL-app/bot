# SBL Bot Discord

Bot Discord utilisant les slash commands pour SBL.

## Installation

1. Clonez le projet
2. Installez les dépendances :
   ```bash
   npm install
   ```

3. Configurez le bot. **En production**, utilisez des variables d'environnement
   (recommandé, aucun secret sur disque) :
   - `DISCORD_TOKEN` : le token du bot Discord
   - `DISCORD_CLIENT_ID` : l'ID de l'application Discord
   - `API_URL` : l'URL de l'API (ex: `https://api.example.com`)

   **En développement local**, vous pouvez créer un `config.json` (ignoré par
   git) avec `token`, `applicationId`, `apiUrl`. Les variables d'environnement
   sont prioritaires sur ce fichier (voir `lib/config.js`).

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

## Qualité, tests et CI/CD

```bash
npm run lint           # analyse statique (ESLint)
npm test               # tests unitaires (Vitest)
npm run test:coverage  # tests + couverture (seuil 80 %)
```

- **CI** (`.github/workflows/ci.yml`) : ESLint, tests + couverture, `npm audit`
  et build de l'image Docker à chaque push / PR.
- **CD** (`.github/workflows/cd.yml`) : déploiement SSH automatique sur `main`
  (rebuild du service `bot` via docker compose). Secrets requis : `SSH_HOST`,
  `SSH_USER`, `SSH_KEY`, `SSH_PORT` (optionnel), `DEPLOY_PATH`.
- **Sécurité** : voir [`SECURITY.md`](SECURITY.md) (revue OWASP Top 10).

Le code testé (fonctions pures) est isolé dans `lib/` :
`config.js` (chargement des secrets), `date-utils.js` (calcul des échéances),
`validation.js` (assainissement des entrées).

## Structure du projet

```
├── main.js              # Fichier principal du bot
├── deploy-commands.js   # Script de déploiement des commandes
├── config.json         # Configuration (token, API URL, etc.)
├── commands/           # Dossier contenant toutes les commandes
│   ├── apistatus.js    # Commande de vérification de l'API SBL
│   ├── serverinfo.js   # Commande d'info serveur Discord
│   ├── seasons.js      # Commande pour lister toutes les saisons
│   ├── season.js       # Commande pour voir une saison spécifique
│   ├── divisions.js    # Commande pour lister les divisions d'une saison
│   ├── division.js     # Commande pour voir une division spécifique
│   └── matchs.js       # Commande pour voir les matchs d'une division
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

1. Redéployez les commandes avec `npm run deploy`
2. Redémarrez le bot

## Commandes disponibles

### 🔧 Utilitaires

- `/apistatus` - Vérifie l'état de l'API SBL
- `/serverinfo` - Affiche les informations du serveur Discord

### 📅 Saisons

- `/saisons [page]` - Liste toutes les saisons avec pagination
- `/saison <id>` - Affiche les détails d'une saison spécifique

### 🏆 Divisions

- `/divisions <saison>` - Liste les divisions d'une saison
- `/division <id>` - Affiche les détails d'une division avec statistiques

### ⚽ Matchs

- `/matchs <division> [page]` - Affiche les matchs d'une division par semaine

## Navigation interactive

Le bot propose une navigation interactive avec des boutons :

- Navigation entre les pages pour les listes longues
- Boutons pour accéder rapidement aux détails
- Retour facile vers les vues précédentes
- Accès direct aux divisions et matchs depuis les saisons
