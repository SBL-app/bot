# Procédure de Déploiement - SBL Discord Bot

Ce guide explique comment déployer le bot Discord SBL sur un VPS avec Docker.

## Prérequis

### Sur votre VPS
- Ubuntu 20.04+ / Debian 11+ (ou autre distribution Linux)
- Docker Engine installé
- Docker Compose installé
- Git installé
- Accès SSH au serveur

### Identifiants requis
- Token du bot Discord
- Application ID Discord
- URL de votre API SBL

---

## 1. Installation de Docker sur le VPS

Si Docker n'est pas encore installé :

```bash
# Mise à jour du système
sudo apt update && sudo apt upgrade -y

# Installation des dépendances
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Ajout du dépôt Docker officiel
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Installation de Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Ajout de l'utilisateur au groupe docker (évite d'utiliser sudo)
sudo usermod -aG docker $USER

# Redémarrer la session SSH pour appliquer les changements
```

Vérifiez l'installation :
```bash
docker --version
docker compose version
```

---

## 2. Cloner le projet

```bash
# Créer un répertoire pour les applications
mkdir -p ~/apps && cd ~/apps

# Cloner le dépôt
git clone <URL_DE_VOTRE_DEPOT> sbl-bot
cd sbl-bot
```

---

## 3. Configuration

### Créer le fichier de configuration

```bash
# Copier le fichier exemple
cp config.json.example config.json

# Éditer avec vos identifiants
nano config.json
```

Remplissez les valeurs :
```json
{
    "token": "VOTRE_TOKEN_DISCORD",
    "applicationId": "VOTRE_APPLICATION_ID",
    "apiUrl": "https://votre-api.com"
}
```

### Sécuriser le fichier de configuration

```bash
# Restreindre les permissions (lecture seule pour le propriétaire)
chmod 600 config.json
```

---

## 4. Déploiement

### Premier déploiement

```bash
# Construire et démarrer le conteneur
docker compose up -d --build
```

### Vérifier le statut

```bash
# Voir l'état du conteneur
docker compose ps

# Voir les logs en temps réel
docker compose logs -f

# Voir les dernières 100 lignes de logs
docker compose logs --tail 100
```

---

## 5. Commandes utiles

### Gestion du conteneur

```bash
# Arrêter le bot
docker compose stop

# Redémarrer le bot
docker compose restart

# Arrêter et supprimer le conteneur
docker compose down

# Reconstruire après une mise à jour du code
docker compose up -d --build
```

### Mise à jour du bot

```bash
cd ~/apps/sbl-bot

# Récupérer les dernières modifications
git pull origin main

# Reconstruire et redémarrer
docker compose up -d --build
```

### Déployer les commandes slash

Les commandes slash sont automatiquement déployées au démarrage du bot. Pour forcer un redéploiement :

```bash
docker compose exec sbl-bot node deploy-commands.js
```

---

## 6. Monitoring et Logs

### Voir les logs

```bash
# Logs en temps réel
docker compose logs -f

# Logs avec horodatage
docker compose logs -f --timestamps

# Filtrer par date
docker compose logs --since "2024-01-01"
```

### Vérifier la santé du conteneur

```bash
# État détaillé
docker inspect sbl-bot --format='{{.State.Health.Status}}'

# Statistiques de ressources
docker stats sbl-bot
```

---

## 7. Configuration du redémarrage automatique

Le bot est configuré avec `restart: unless-stopped`, ce qui signifie :
- Il redémarre automatiquement après un crash
- Il redémarre au démarrage du serveur
- Il ne redémarre pas si vous l'arrêtez manuellement

Pour s'assurer que Docker démarre au boot :
```bash
sudo systemctl enable docker
```

---

## 8. Sauvegarde

### Sauvegarder la configuration

```bash
# Créer un répertoire de sauvegarde
mkdir -p ~/backups

# Sauvegarder les fichiers de configuration
cp ~/apps/sbl-bot/config.json ~/backups/config.json.$(date +%Y%m%d)
cp -r ~/apps/sbl-bot/config ~/backups/config.$(date +%Y%m%d)
```

---

## 9. Dépannage

### Le bot ne démarre pas

1. Vérifiez les logs :
   ```bash
   docker compose logs --tail 50
   ```

2. Vérifiez que config.json existe et est valide :
   ```bash
   cat config.json | python3 -m json.tool
   ```

3. Vérifiez les permissions :
   ```bash
   ls -la config.json
   ```

### Le bot se déconnecte fréquemment

1. Vérifiez les ressources :
   ```bash
   docker stats sbl-bot
   ```

2. Vérifiez la connectivité réseau :
   ```bash
   docker compose exec sbl-bot ping -c 3 discord.com
   ```

### Erreur de token invalide

1. Vérifiez que le token dans config.json est correct
2. Regénérez un nouveau token sur le [Portail Discord Developer](https://discord.com/developers/applications)
3. Mettez à jour config.json et redémarrez :
   ```bash
   docker compose restart
   ```

---

## 10. Architecture

```
sbl-bot/
├── docker-compose.yml    # Orchestration Docker
├── Dockerfile            # Image Docker
├── config.json           # Configuration (NON versionné)
├── config/               # Paramètres persistants
│   ├── channels.json
│   └── settings.json
├── main.js               # Point d'entrée du bot
├── commands/             # Commandes slash
└── scheduler/            # Tâches planifiées
```

---

## Résumé des commandes

| Action | Commande |
|--------|----------|
| Démarrer | `docker compose up -d` |
| Arrêter | `docker compose stop` |
| Redémarrer | `docker compose restart` |
| Logs | `docker compose logs -f` |
| Reconstruire | `docker compose up -d --build` |
| Mettre à jour | `git pull && docker compose up -d --build` |
| Supprimer | `docker compose down` |
