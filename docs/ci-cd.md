# CI/CD GymDash

Le workflow `.github/workflows/ci-cd.yml` reprend les étapes de `gympass-site` : validation, construction Docker, publication et déploiement Coolify.

- Pull request vers `main` : tests du déploiement, `npm ci`, build Next et vérification standalone. Aucun accès aux secrets de déploiement, aucune publication.
- Push sur `main` ou lancement manuel depuis `main` : mêmes contrôles, publication de `electronteams/gymdash:sha-<SHA complet>`, puis déploiement de cette version exacte.
- Les exécutions de production sont sérialisées et ne sont pas annulées pendant un déploiement.

## Configuration GitHub Actions

Secrets du dépôt : `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `COOLIFY_API_TOKEN`.

Variables du dépôt : `COOLIFY_BASE_URL` (origine du serveur, sans `/api/v1`), `COOLIFY_APP_UUID` (`ijpluezkha433o1szxfxaqzp`). Les identifiants ont été configurés à partir de `.mcp.json`, sans copier ce fichier dans le dépôt.

L'application conserve son mode Coolify `dockerimage`. Les variables applicatives restent dans Coolify : elles ne sont pas transmises à la construction Docker. Le déclenchement natif sur push doit être désactivé ; GitHub Actions orchestre le déploiement après les contrôles.

## Contrôles et reprise

`node --test scripts/coolify-deploy.test.mjs` teste le script sans réseau. Avec `COOLIFY_CHECK_ONLY=true`, le script vérifie uniquement l'authentification par une lecture de l'application.

Le script configure le tag exact, appelle une seule fois `POST /api/v1/deploy`, attend l'état `finished` de son UUID et vérifie `https://dash.gympass.minifootapp.com/login`. Un HTTP 401 demande de remplacer le secret `COOLIFY_API_TOKEN` par un jeton API Coolify valide ; un secret de webhook GitHub n'est pas un jeton API.

Si l'appel de déploiement expire, examiner la file Coolify avant de relancer : il peut avoir été accepté. Les mutations ne sont jamais rejouées automatiquement. En cas d'échec, le journal donne l'ancienne révision : remettre son tag dans Coolify et redéployer. Aucun retour automatique n'est appliqué.

Références : [API de déploiement Coolify](https://coolify.io/docs/api/endpoints/deployments/deploy-by-tag-or-uuid), [configuration d'application](https://coolify.io/docs/api/endpoints/applications/update-application-by-uuid).
