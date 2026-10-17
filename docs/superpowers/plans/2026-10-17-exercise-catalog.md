# Flow exercise catalog implementation plan

**Goal:** Browse Flow demonstrations with Hasan French instructions, import or attach an exercise, and review the movement before publication.
**Authorization:** User approved Flow + Hasan exploration and now instructed “commence”. Existing publication preferences remain backend Git and GymDash Docker Hub/Coolify.
**Architecture:** Pinned, pre-rendered GIF/poster assets stored in the existing MinIO bucket; only the normalized catalog, attribution and checksums are bundled with the backend. Admin-only catalog and mutations behind the existing platform guard, with a Next server proxy that keeps the GymDash secret out of the browser. No runtime calls to GitHub, no Gym Visual media, no automatic publication or mass database import.
**Tech:** NestJS/Prisma/Postgres, Next/React, offline Python SVG-to-GIF build.

## Constraints and rulings

- Preserve existing exercise IDs/program links and all unrelated work, particularly staged billing files in GymDash. Agents have disjoint file ownership; no agent commits, pushes or deploys.
- Existing active exercises are not mass-deactivated; missing animations remain visible to admins for linking. New/changed media starts as draft and publication requires an explicit reviewed=true request and a valid available animation.
- 1,324 catalog records, 1,257 available animations, 67 without media. Do not substitute another exercise's animation for unavailable media.
- Flow media CC0 dedication has documented provenance limitations; Hasan data MIT attribution retained; no Hasan/Gym Visual GIFs imported. Admin must review instructions and movement.
- No new library required for browser animation playback: native GIF image with pause/poster fallback and reduced-motion support. No arbitrary SVG insertion or arbitrary remote-media URLs.
- Existing GymBro user APIs still return published exercises, now including animation metadata. Draft exercise details cannot be read by user API.

## Shared API contract

Backend base `/api/v1/gymbro/exercises`, frontend proxy `/api/exercises`.

- `GET admin/all` -> existing array enriched with `animationUrl`, `animationPosterUrl`, `animationLicense` and source/review fields.
- `GET admin/catalog?q=&group=&equipment=&page=1&hasAnimation=true` -> `{items,total,page,pageSize:24,filters:{groups,equipment},stats:{total,animated,withoutAnimation}}`.
- Catalog item: `{source:'flow',sourceId,sourceRevision,nameOriginal,instructionsFr:string[],groupeMusculaire,musclesPrimaires:string[],musclesSecondaires:string[],equipementRequis,hasAnimation,animationUrl:string|null,posterUrl:string|null,license:'CC0-1.0',importedExerciseId:string|null}`.
- `POST admin/import` body `{sourceId,nomFr?:string}` -> exercise. Idempotent by source + sourceId; returns existing exercise instead of duplicating. New exercise is draft.
- `PATCH admin/:id/source` body `{sourceId}` -> exercise. Attach animation to existing ID, reset review and deactivate until reviewed; conflict if source already belongs to another internal exercise.
- `PATCH admin/:id` body existing editable fields -> exercise. Server validates JSON instruction/muscle strings and bounded inputs, and controls provenance fields itself.
- `PATCH admin/:id/toggle` body `{reviewed?:boolean,expectedUpdatedAt?:string}` -> exercise. Activation needs an available media binding, explicit reviewed=true and the version that was reviewed. Deactivation needs no confirmation.
- `POST admin` preserves manual draft creation; cannot directly publish an unreviewed exercise.
- MinIO media URLs point only to indexed GIF/PNG pairs at a pinned version. The compatibility route `GET media/flow/:revision/:file` redirects to the indexed MinIO URL; local fixtures still stream fixed MIME types. No arbitrary paths or remote URL fetching.

## User steering during implementation

- User requested MinIO for images. Existing `gympass` bucket already permits public object reads; no policy changes or new credentials are needed. Dedicated immutable prefix: `exercises/gif750-v1/flow/<Flow revision>/`.
- User found animations too fast. Keep original position sequence 0/1/2/1, slow each frame to 750ms (three seconds per cycle). This illustrates movement, not prescribed exercise tempo.
- Build output stays in workspace `.tmp`, outside Git/Docker. Publish script verifies local SHA-256, remote object metadata and representative anonymous HTTPS bytes/MIME/cache before writing the active MinIO catalog manifest.

## Catalog artifact contract (root owns assets/build tooling)

`gympass_backend/assets/exercise-catalog/catalog.json`:
`{version:1,source:'flow',revision:<flow commit>,dataRevision:<Hasan commit>,exercises:[{sourceId,nameOriginal,instructionsFr,groupeMusculaire,musclesPrimaires,musclesSecondaires,equipementRequis,hasAnimation,license:'CC0-1.0'}]}`.
The `media` manifest extension stores `{storage:'minio',baseUrl,files}`. Files live under `<baseUrl>/flow/<revision>/<id>.gif` and `<id>.png`. Temporary local rendering uses the same relative paths. Sources pinned, ID/name matching checked, license notices preserved. Backend derives URLs from this manifest. Never mark the supplier artwork as professionally verified.

## Tasks

- [x] Build reproducible pinned catalog/assets; verify all media pairs and record licenses. 2,514 MinIO objects verified; all 1,257 GIF cycles verified at 3,000ms.
- [x] Backend additive schema/migration, catalog service, platform-only admin endpoints, guarded publication, real HTTP/auth and duplicate import tests. 15 tests and real PostgreSQL fixture passed.
- [x] Frontend secret-safe proxy, searchable catalog with filters/previews, import/edit/link/review workflow, useful error and draft states; targeted proxy tests and build. Four proxy tests, TypeScript, targeted ESLint and Docker build passed.
- [x] Review contracts and authorization end to end; check real PostgreSQL constraints, existing exercise compatibility, and GIF/reduced-motion behavior. Eight browser checks and code review completed.
- [x] Publish backend via its isolated Git branch and dashboard via Docker Hub; verify the already-applied exercise schema in read-only mode, authenticated catalog/media and production health without automatically publishing exercises.

## Isolated production release

The first backend rollout from main was blocked by the separate phone OTP
migration `20261017150000_gymbro_phone_otp` (SQLSTATE 23505: two existing accounts
share a nonempty telephone). The user delegated the choice of the best solution;
the catalog is isolated from that unfinished change without modifying accounts.

Backend deployment branch: `release/gymbro-exercise-catalog-20261017`, commit
`99531e5`. Authentication/WhatsApp match healthy baseline `afcf9f4`; the only Prisma
schema changes relative to baseline are the four exercise provenance columns and
source-pair unique constraint. Main and its phone work remain intact.

Runtime settings `SKIP_PRISMA_MIGRATIONS=true`, `SKIP_PRISMA_SEED=true` and
`EXERCISE_CATALOG_PREFLIGHT=true` preserve migration history and accounts. A
SELECT-only startup guard requires the catalog migration to be already finished,
all four exercise columns, and a valid unique index. Two guard tests and an actual
PostgreSQL fixture passed. Full release build and 15 exercise tests passed.

Before deploying future schema changes or switching Coolify back to main, resolve
the phone duplicate policy and restore normal migration settings. Release notes:
`gympass_backend/.claude/worktrees/exercise-catalog-release/scripts/EXERCISE_CATALOG_RELEASE.md`.

GymDash image digest: `sha256:173cb4572626b27673addbe713e4780eeeb8f7e54f36f6fea5bee0b2f39a07ca`.
Dashboard source commit `e44c7fa` remains local: auto-review refused a dashboard
Git push because the authorized publication method is Docker Hub. Docker image
push and Coolify dashboard deployment completed successfully.

Final deployment `ul1fzjrgbcyqr8fi6dc2gdkb` finished; backend is running:healthy.
Production health HTTP 200, real catalog 1,324/1,257/67, 24 items per page, MinIO
GIF HTTP 200, production and localhost dashboard proxies both return the catalog,
anonymous dashboard request HTTP 401. Production verification performed no data
mutations or exercise imports/publications.

## Verification ledger

Pending. No database exercises imported or activated by setup.
