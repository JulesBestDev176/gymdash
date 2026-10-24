# Android releases in GymDash

`/app-releases` is reserved for allowlisted platform administrators. **Système → Versions Android** opens the APK upload page. The sidebar link remains visible while access is being checked or the service is unavailable, so an outage cannot silently remove navigation. A confirmed authorization denial hides the link. An ordinary gym `ADMIN` receives a restricted-access page and cannot upload or publish; backend authorization is unchanged.

1. Build and sign the Android APK with the installed application's package and signing key (`com.gympass.gympass_sn`). Choose a higher `versionCode` than the active release.
2. Open **Système → Versions Android**, select the APK (maximum 256 MiB) and enter release notes (maximum 10,000 characters).
3. **Importer le brouillon** uploads only a private draft. Progress reports browser upload; analysis and storage finish afterwards. The backend extracts the real package, version, size and SHA-256.
4. Review the draft's version, package, notes and SHA-256 under **Détails et notes**. Click **Publier** and accept the confirmation to make it available. Publishing requires a strictly higher versionCode; retrying an already-published release is idempotent.
5. The active version summary refreshes after publication. History uses cursor pages of 20. On network errors, refresh history before retrying an upload or publication to determine whether it already completed.

The first installation remains an explicit APK installation outside the app. Publishing a release alone does not install it on devices; supported installed apps offer their update icon and Android asks the user to confirm installation.

## Server configuration and request limits

Set `GYMDASH_SECRET` only on the Next.js server, plus `API_INTERNAL_URL` (preferred) or `NEXT_PUBLIC_API_URL`. The release browser code never imports the legacy `adminApi` client or reads the secret. The BFF injects the secret upstream and forwards the user's bearer token. Every backend admin endpoint must retain JWT authentication and the strict `BillingAdminGuard` platform allowlist. The BFF verifies this guard via an authenticated read before accepting upload bytes or issuing any publication; it never authorizes from a role claim alone.

The BFF accepts only `access`, `latest`, `admin`, and `admin/:id/publish`, forwards only the cursor query, disables caching and redirects, sanitizes server failures, and never retries writes automatically. APK downloads use the backend's published-only public endpoint. There is no release mutation on page load.

Configure the dashboard ingress, backend ingress, and any hosting request limits to allow at least **257 MiB** for a 256 MiB APK plus multipart overhead, and up to **300 seconds** for uploads. This uses a Node.js route handler with a 300-second upstream timeout; external hosting may impose stricter limits. After verifying platform authorization, the BFF streams multipart bytes upstream with backpressure and a 257 MiB byte cap, aborting oversized transfers without collecting the APK in dashboard memory. The backend enforces the exact APK limit and validates package metadata. Keep the backend's storage bucket private and retain published objects immutably.

Deploy the backend migration, storage/parser dependencies and guarded release endpoints before enabling the dashboard. No release is created or published by deployment, code changes, or build commands.

The dashboard's existing Next.js 16.4.0 triggered its security advisory build reminder during validation. `next` and `eslint-config-next` are patched together to 16.4.1, preserving the React versions. This is the minimum fix identified in the [official October 2026 security update](https://nextjs.org/blog/nextjs-security-update-october-14-2026) for the typed-array cache RCE, SVG image optimization RCE, and Server Actions denial of service advisories. The security reminder is not disabled.

## Verification

```powershell
node --experimental-strip-types --test tests/app-releases-api.test.mjs
npx tsc --noEmit
npm run lint
npm run build
```

The BFF contract tests cover the fixed route allowlist, JWT and missing-secret handling, strict backend authorization before writes, cursor forwarding/page size, multipart preservation, explicit publication, guarded latest lookup and sanitized failures. They use a stub upstream and do not create real releases.

`tests/app-releases-ui.browser.mjs` also exercises denied access/menu visibility, no mutation on load, cursor navigation, multipart notes, draft details, cancelling and confirming publication, latest refresh, and mobile overflow. It uses the existing local Playwright/browser fixture under `../.tmp/exercise-browser` and a dashboard at `http://localhost:3017` (override with `RELEASE_TEST_URL`). All release network responses are fixtures; the script never publishes to a backend.
## Uploads interrompus et actualisation

La réception des gros APK doit être autorisée pendant **300 secondes sur les deux points d'entrée Traefik**, au lieu du délai de lecture par défaut de 60 secondes :

```yaml
- '--entrypoints.http.transport.respondingtimeouts.readtimeout=300s'
- '--entrypoints.https.transport.respondingtimeouts.readtimeout=300s'
```

Ce réglage a été appliqué et vérifié en production le 24 octobre 2026. Les tailles maximales restent identiques. La requête BFF est bornée à 330 secondes et le navigateur à 360 secondes, pour laisser une marge à l'analyse et au stockage. Aucun timeout n'est illimité.

La barre affiche les octets transmis par le navigateur, pas une publication confirmée. À 100 %, l'analyse du fichier et la création du brouillon peuvent encore être en cours. Après 15 secondes sans progression, la page indique explicitement que le réseau ou le serveur peut être lent.

Pendant l'import, un avertissement natif protège l'actualisation/la fermeture de la page. Si l'utilisateur continue malgré cet avertissement, le flux du fichier peut être interrompu : il **ne reprend pas automatiquement** après rechargement. Les métadonnées du dernier import non confirmé sont conservées dans `sessionStorage`, par compte et par onglet. La page invite à vérifier l'historique avant de sélectionner à nouveau le fichier ; aucune écriture n'est relancée automatiquement. Les métadonnées sont effacées après une réponse de création réussie ou après confirmation manuelle de la vérification.

Contrôles supplémentaires :

```powershell
node --experimental-strip-types --test tests/release-upload.test.mjs tests/app-releases-api.test.mjs
node tests/app-releases-recovery.browser.mjs
```

Le second test utilise des réponses simulées sur un dashboard local, notamment un transfert suspendu puis une actualisation. Il ne crée ni ne publie d'APK réel.
