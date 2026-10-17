# Monitoring et WhatsApp

Les pages `/monitoring` et `/whatsapp` sont déployées sur GymDash. Le navigateur transmet la session existante ; chaque route Next vérifie son rôle ADMIN auprès du backend. Les clés Coolify, Relayio et du collecteur restent dans les variables serveur.

## Données suivies

- CPU, mémoire et espace disque du serveur ; collecte toutes les 30 secondes.
- Conteneurs et volumes des seuls services GymPass et Relayio autorisés.
- Requêtes du backend par méthode et route normalisée, moyenne, maximum, p95/p99 estimés, compteurs 4xx et 5xx.
- Configurations de sauvegarde PostgreSQL, exposition de la base, utilisateur et privilèges des conteneurs, HTTPS.
- Alertes affichées dans le tableau. Aucun envoi automatique de message ou notification externe n'est configuré.

L’historique SQLite est conservé sept jours sur le volume persistant du service Coolify `gympass-monitoring` (`qna96tjbgbobuzsru10oumeg`). Les données sont collectées même lorsque le tableau est fermé. Les courbes sont regroupées en intervalles adaptés à la période ; les valeurs indisponibles ne sont pas simulées. Les durées p95/p99 sont des estimations par histogrammes. Les compteurs ne représentent pas le trafic antérieur à l’activation.

Le collecteur n'a ni domaine ni port hôte publié. Il est accessible sur le réseau Docker `coolify` via `http://gympass-monitoring-agent:9108`, avec authentification par jeton. Les montages hôte et socket Docker sont en lecture seule ; le socket demeure une capacité sensible, même monté en lecture seule. Le code du collecteur n’émet que des appels GET au moteur Docker. L’image du collecteur est fixée par digest pour éviter les anciennes versions en cache.

## Relayio

L’intégration utilise le service auto-hébergé `https://relayio.minifootapp.com/v1`, l’en-tête `x-api-key` et la session `Loyalty`. Seuls les messages sortants sont retournés par la route serveur ; les messages reçus sont exclus de l’historique et des statistiques. Un envoi exige une action explicite sur la page. Aucun message réel n’a été envoyé lors de la validation.

La clé récupérée depuis Coolify est enregistrée dans `.env.local` (ignoré par Git) et dans les variables runtime de GymDash, avec `RELAYIO_BASE_URL` et `RELAYIO_SESSION_ID`.

## Exploitation

En développement local (`npm run dev`), définir `MONITORING_PROXY_URL=https://dash.gympass.minifootapp.com/api/monitoring` dans `.env.local`. Le nom Docker `gympass-monitoring-agent` est privé au serveur et ne se résout pas sur le poste de développement. La route locale récupère les données via HTTPS avec le JWT de l’utilisateur connecté, sans exposer le collecteur ou transmettre sa clé. Cette option est ignorée en production, qui continue de joindre le collecteur interne. Si le monitoring déployé est indisponible, la page locale signale explicitement l’échec.

`scripts/configure-monitoring.ps1` vérifie la configuration sans écriture ; `-Apply` configure les variables et crée le service s’il manque. Il conserve les autres variables du backend. Le backend demeure déployé depuis son dépôt avec le code de télémétrie validé ; aucune modification de schéma n’est nécessaire.

`scripts/verify-monitoring.ps1 -RequireMetrics` vérifie en production le refus des appels anonymes, la lecture administrateur du monitoring et la session WhatsApp. Il utilise le compte documenté dans `../TEST_CREDENTIALS.md` et n’affiche ni identifiants ni contenu des messages.

Tests :

```powershell
# Depuis GymPass
python -m unittest discover -s monitoring-agent -p 'test_*.py' -v
# Depuis gympass_backend
node --test src/monitoring/telemetry.test.cjs
# Depuis gymdash
node --experimental-strip-types --test tests/admin-auth.test.mjs tests/monitoring-model.test.mjs lib/server/relayio.test.ts
```

La validation initiale couvre 44 tests, les builds Docker/TypeScript et les routes réelles en production. La vérification visuelle automatisée n’était pas disponible, aucun navigateur n’étant connecté.
