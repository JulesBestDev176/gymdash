# Monitoring et Relayio Implementation Plan

> **For agentic workers:** Use independent parallel tasks with explicit file ownership; integrate and request a read-only code review before deployment.

**Goal:** Deliver the approved monitoring dashboard and connect the existing self-hosted Relayio.

**Architecture:** Internal Python collector with persistent SQLite and token-authenticated HTTP. NestJS batches real request histograms into it. Next.js proxies collector/Coolify/Relayio after validating the existing admin JWT.

**Tech Stack:** Python standard library, SQLite, Docker, NestJS 10, Next.js 16.4, React, Recharts.

**Spec:** ../specs/2026-10-17-monitoring-relayio-design.md

## Global Constraints

- Preserve all preexisting working tree modifications; no commits or Git pushes required.
- Never print secrets, send WhatsApp messages during verification, expose collector ports, or store request bodies/URLs containing identifiers.
- Seven days of persistent history; absent metrics stay absent.
- Root owns GymDash monitoring/auth/Coolify routes and deployments. Relay worker owns WhatsApp files. Collector worker owns monitoring-agent/. Backend worker owns backend monitoring instrumentation only.

## Task 1: Persistent collector

- [x] Write Python unittest cases for unauthorized access, histogram quantiles, idempotent ingestion, retention and persistence across reopening.
- [x] Run `python -m unittest discover -s monitoring-agent -p 'test_*.py'` before and after implementation.
- [x] Implement `GET /snapshot?hours=24` and `POST /ingest` guarded by `Authorization: Bearer MONITORING_TOKEN`, plus unauthenticated `/health` returning no data. GET snapshot returns `timestamp`, `server`, `history`, `storage`, `containers`, `api`, `alerts`, `collection`.
- [x] Ingestion accepts `{batchId, app, points:[{minute, method, route, count, errors4xx, errors5xx, durationSumMs, maxMs, buckets:number[]}]}` with bucket ceilings `[5,10,25,50,100,200,300,500,750,1000,1500,2000,3000,5000,10000,30000,60000]` plus overflow. Histograms use exclusive counts; deduplicate batchId persistently.
- [x] Package Docker image on port 9108 with /data SQLite, /host/proc and /host disk statistics, Docker socket GET only. Filter container/storage metadata by approved resource UUIDs.

## Task 2: Backend request instrumentation

- [x] Add tests for response timing, route normalization, status buckets, failed flush recovery, disabled sink and bounded aggregation.
- [x] Implement middleware and lifecycle flush using MONITORING_URL and MONITORING_TOKEN with 30-second batches using Task 1 ingestion contract. Retries reuse batchId, never await network on request finish. Keep bounded pending data.
- [x] Register in AppModule/main without changing endpoint responses or requiring database migrations.
- [x] Run tests and `npm run build`; document env variables.

## Task 3: Relayio adapter

- [x] Verify real schema and redacted response shapes through Coolify credentials.
- [x] Test normalized messages/session health and upstream failures, missing config and send contract without sending messages.
- [x] Replace obsolete api.relay.io adapter with self-hosted URL, x-api-key, session selection and message normalization. Guard routes through root's `requireAdmin(request)` from `lib/server/admin-auth.ts`, returning `Response | null` (null permits access).
- [x] Update WhatsApp UI to use `authenticatedFetch` from `lib/authenticated-fetch.ts`, show actual configuration/session state and upstream failures; retain explicit user-initiated send only. Remove incorrect external configuration links.

## Task 4: Auth, monitoring API and UI

- [x] Add real-behavior tests for admin verification, service status, HTTP failures and alert thresholds.
- [x] Implement `requireAdmin` against POST /api/v1/auth/me, role ADMIN; expose authenticatedFetch that forwards existing localStorage JWT.
- [x] Replace hardcoded Coolify secrets with env; fetch only approved GymPass resource IDs plus Relayio status. Merge collector data, backups metadata and explicit partial errors. Maintain services/serverStatus/timestamp compatibility for audit page.
- [x] Build responsive Recharts views for system history, per-route request latency/error rate, storage, security configuration and alerts. Do not fabricate data when collector is unavailable.
- [x] Restrict redeployment UUIDs and propagate failures; update audit fetch auth.
- [x] Review changes with read-only reviewer; run meaningful tests and Docker build.

## Task 5: Deployment and verification

- [x] Build and push collector and dashboard images with authorized Docker Desktop account. Publish the verified backend image; retain the existing source deployment after confirming the running commit matches the validated telemetry code. Preserve app config.
- [x] Register collector Compose service through Coolify using internal coolify network, persistent data and read-only host/Docker mounts; no host port mappings.
- [x] Copy actual Relayio credentials from Coolify to local/production envs and configure collector URL/token on dashboard/backend without printing values.
- [x] Verify collector history advances independently, real backend metrics appear, anonymous API requests fail, WhatsApp session reads succeed, Coolify deployment finishes and public build ID matches.

## Progress

Completed 2026-10-17. Dashboard and digest-pinned internal collector deployed. Backend source deployment verified against local runtime code. 44 tests pass; public build ID matches; all four services up; three volumes measured; live API histograms and Relayio session reads verified. History survives collector restarts. No WhatsApp message sent. Browser visual verification unavailable (no connected browser).
