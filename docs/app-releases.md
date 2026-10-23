# Android releases in GymDash

`/app-releases` is reserved for allowlisted platform administrators. The sidebar link appears only after the server verifies access. An ordinary gym `ADMIN` receives a restricted-access page and cannot upload or publish.

1. Build and sign the Android APK with the installed application's package and signing key (`com.gympass.gympass_sn`). Choose a higher `versionCode` than the active release.
2. Open **Système → Versions Android**, select the APK (maximum 256 MiB) and enter release notes (maximum 10,000 characters).
3. **Importer le brouillon** uploads only a private draft. Progress reports browser upload; analysis and storage finish afterwards. The backend extracts the real package, version, size and SHA-256.
4. Review the draft's version, package, notes and SHA-256 under **Détails et notes**. Click **Publier** and accept the confirmation to make it available. Publishing requires a strictly higher versionCode; retrying an already-published release is idempotent.
5. The active version summary refreshes after publication. History uses cursor pages of 20. On network errors, refresh history before retrying an upload or publication to determine whether it already completed.

The first installation remains an explicit APK installation outside the app. Publishing a release alone does not install it on devices; supported installed apps offer their update icon and Android asks the user to confirm installation.

## Server configuration and request limits

Set `GYMDASH_SECRET` only on the Next.js server, plus `API_INTERNAL_URL` (preferred) or `NEXT_PUBLIC_API_URL`. The release browser code never imports the legacy `adminApi` client or reads the secret. The BFF injects the secret upstream and forwards the user's bearer token. Every backend admin endpoint must retain JWT authentication and the strict `BillingAdminGuard` platform allowlist. The BFF verifies this guard via an authenticated read before accepting upload bytes or issuing any publication; it never authorizes from a role claim alone.

The BFF accepts only `access`, `latest`, `admin`, and `admin/:id/publish`, forwards only the cursor query, disables caching and redirects, sanitizes server failures, and never retries writes automatically. APK downloads use the backend's published-only public endpoint. There is no release mutation on page load.

Configure the dashboard ingress, backend ingress, and any hosting request limits to allow at least **257 MiB** for a 256 MiB APK plus multipart overhead, and up to **300 seconds** for uploads. This uses a Node.js route handler with a 300-second upstream timeout; external hosting may impose stricter limits. Multipart buffering is bounded at 257 MiB, so provision server memory for concurrent uploads. The backend enforces the exact APK limit and validates package metadata. Keep the backend's storage bucket private and retain published objects immutably.

Deploy the backend migration, storage/parser dependencies and guarded release endpoints before enabling the dashboard. No release is created or published by deployment, code changes, or build commands.

## Verification

```powershell
node --experimental-strip-types --test tests/app-releases-api.test.mjs
npx tsc --noEmit
npm run lint
npm run build
```

The BFF contract tests cover the fixed route allowlist, JWT and missing-secret handling, strict backend authorization before writes, cursor forwarding/page size, multipart preservation, explicit publication, guarded latest lookup and sanitized failures. They use a stub upstream and do not create real releases.

`tests/app-releases-ui.browser.mjs` also exercises denied access/menu visibility, no mutation on load, cursor navigation, multipart notes, draft details, cancelling and confirming publication, latest refresh, and mobile overflow. It uses the existing local Playwright/browser fixture under `../.tmp/exercise-browser` and a dashboard at `http://localhost:3017` (override with `RELEASE_TEST_URL`). All release network responses are fixtures; the script never publishes to a backend.
