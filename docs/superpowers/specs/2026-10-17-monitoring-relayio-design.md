# Monitoring complet et Relayio

Périmètre approuvé dans la conversation le 17 octobre 2026 : monitoring complet et raccordement Relayio sur Coolify.

## Architecture

GymDash présente l'état Coolify, les graphes CPU/mémoire/disque, les volumes et sauvegardes, les contrôles de configuration sécurité, les alertes et les durées HTTP réelles par route. Un collecteur Python sans dépendance conserve les échantillons serveur et les agrégats HTTP en SQLite sur un volume persistant, pendant sept jours. Il écoute sur le réseau Docker interne, sans port public, avec authentification par jeton. Il lit uniquement /proc, le disque hôte monté en lecture seule et les endpoints GET de Docker. Les réponses ne contiennent jamais les variables d'environnement des conteneurs.

Le backend NestJS mesure les requêtes sur l'événement finish, normalise les routes, exclut les endpoints de collecte et regroupe les observations par minute. Il transmet les agrégats au collecteur par lots hors du chemin de réponse. Les p95/p99 sont estimés à partir d'histogrammes, avec limites explicites. Aucun corps, jeton, identifiant personnel ou paramètre de requête n'est enregistré.

Les routes serveur de GymDash vérifient le JWT auprès de l'API existante et le rôle ADMIN, puis utilisent les secrets serveur. Le navigateur ne reçoit pas les clés Coolify/Relayio/collecteur. Les boutons de redéploiement sont limités aux applications GymPass connues. Aucune alerte WhatsApp ni aucun message de test n'est envoyé automatiquement ; les alertes sont visibles dans le dashboard.

## Relayio

Utiliser https://relayio.minifootapp.com/v1 avec x-api-key. Lire les sessions, puis les messages via /sessions/{id}/messages ; envoyer uniquement sur action explicite via /sessions/{id}/messages/text. La session READY existante est présélectionnée uniquement si elle est la seule disponible ; le nom réel Loyalty reste affiché. Les clés sont copiées de Coolify vers les variables serveur locales et de production sans être affichées. Ne pas modifier les notifications automatiques du backend ni envoyer de message pendant les tests.

## Mesures et limites

Collecte toutes les 30 secondes, historique indépendant du navigateur, fenêtres 1h/24h/7j. Données absentes = indisponibles, jamais zéro simulé. Volume sizes are Docker-reported and can be unavailable for bind mounts. Montrer les contrôles réellement vérifiables (HTTPS, ports publiés, conteneurs privilégiés/root, authentification, sauvegardes configurées), sans prétendre réaliser un audit de vulnérabilités. L'historique commence à l'installation. Les backups sont rapportés depuis Coolify et aucune sauvegarde/restauration n'est déclenchée.

## Validation

Tests de contrat Relayio et normalisation ; tests Python sur persistance, autorisation, histogrammes, rétention ; tests backend de mesures et routes normalisées ; build TypeScript et Docker ; test du collecteur réel, refus des requêtes anonymes et comparaison du build déployé. Publier les images Docker Hub puis déployer sur Coolify, conserver les réglages applicatifs existants.
