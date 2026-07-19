# Sécurité — Bot SBL

Revue de sécurité alignée sur le **OWASP Top 10 (2021)**.

## Mesures en place

| Risque OWASP | Mesure |
| --- | --- |
| **A01 — Contrôle d'accès** | Le bot n'expose aucun port (voir `Dockerfile`, `docker-compose`). Il ne fait que des connexions sortantes vers Discord et l'API interne via la passerelle. |
| **A02 — Défaillances cryptographiques** | Aucun secret n'est stocké en clair dans le dépôt. Le token Discord et les identifiants proviennent de variables d'environnement (`lib/config.js`), `config.json` étant ignoré par git. |
| **A03 — Injection** | Les entrées utilisateur sont assainies (`lib/validation.js`) : suppression des caractères de contrôle, échappement du markdown Discord, neutralisation des mentions `@everyone`/`@here`, et encodage systématique des paramètres d'URL (`buildQuery`, `encodeURIComponent`) avant tout appel API. |
| **A05 — Mauvaise configuration** | Conteneur non-root, `read_only: true`, `no-new-privileges`, `tmpfs` pour `/tmp`. `assertConfig()` échoue au démarrage si un secret obligatoire manque. |
| **A06 — Composants vulnérables** | Suppression du paquet factice `fs` (masquait le module natif). `npm audit --audit-level=high` exécuté en CI. |
| **A08 — Intégrité logicielle** | Dépendances verrouillées (`package-lock.json`), build Docker reproductible, `npm ci`/`npm install` en CI. |
| **A09 — Journalisation** | Les erreurs sont journalisées sans exposer de secret ; les réponses non-JSON de l'API sont tronquées avant log. |

## Bonnes pratiques de déploiement

- Ne jamais commiter `config.json` ni de fichier `.env`.
- Régénérer le token Discord s'il a pu fuiter.
- Restreindre les permissions du bot Discord au strict nécessaire.

## Signaler une vulnérabilité

Ouvrir une issue privée ou contacter un mainteneur du projet. Ne pas divulguer
publiquement une faille avant correction.
