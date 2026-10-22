# Gym billing implementation plan

> For agentic workers: use subagent-driven-development to implement the independent tasks, then review integration.

**Goal:** Manage manual gym subscriptions, grace enforcement and invoice PDFs inside GymDash.
**Architecture:** Separate platform billing records and settings from member revenue. Backend transactional ledger, server-only Next gateway and management UI, common JWT access enforcement.
**Tech Stack:** Existing NestJS, Prisma/PostgreSQL, Next.js, React; server-side PDF generation.
**Spec:** ../specs/2026-10-17-gym-billing-design.md

## Global constraints
No real invoices/payments seeded or created during verification. Existing gyms remain unconfigured/unblocked. Do not print secrets. No Git or deployment from child agents. Preserve concurrent changes. Additive migration only. Platform billing access requires configured administrator allowlist.

### Task1 Backend ledger and PDF (billing_backend agent)
- [x] Write failing policy/ledger/auth tests, implement Prisma billing models and SQL migration.
- [x] Implement serializable idempotent invoice/payment commands, settings, queries, cancellation and PDF.
- [x] Use disposable PostgreSQL16 integration fixtures to prove balances, rollback and concurrency.
- [x] Build, report contract and migration, no production writes.
Files: prisma/schema.prisma + migrations; src/platform-billing/*; src/app.module.ts registration; package files only if PDF dependency required.

### Task2 Frontend management (billing_ui agent)
- [x] Consume exact spec contract via authenticatedFetch /api/billing.
- [x] Add /subscriptions UI with Salles,Factures,Paramètres, ledger forms and PDF downloads.
- [x] Add sidebar link, bounded filters/pagination, accessible status/errors and retry-safe command ids.
- [x] Run tsc and scoped lint; no gateway/backend/deploy changes.

### Task3 Access enforcement and gateway (root)
- [x] Test UTC month/grace policy and blocked-session access.
- [x] Add access service/module and integrate JwtAuthGuard with platform-management/account-security exemptions.
- [x] Test and implement authenticated allowlisted Next gateway, preserve PDF/cache and sanitized errors.
- [x] Coordinate model names and policy functions with backend agent before touching dependent fields.

### Task4 Review, migration rehearsal and rollout (root+reviewer)
- [x] Independent security/data-integrity review; fix findings.
- [x] Fresh builds, PDF rendering, source/HTTP checks and migration rehearsal.
- [x] Privately back up DB and configure existing administrator allowlist before additive production migration.
- [x] Deploy backend source and dashboard DockerHub, verify read-only local/production endpoints and existing monitoring.

## Verification completed 2026-10-17

- PostgreSQL16: 15 billing tests passed with no skips; disposable container and volume removed.
- Additional isolated Nest PDF HTTP test passed; fictitious sample PDF rendered and inspected.
- Frontend: TypeScript, scoped ESLint,8 proxy/intent tests and Docker production build passed.
- Successful private PostgreSQL backup before additive migration; backend deployed56bc852.
- Local and production billing checks passed:401 anonymous,200 admin,400 invalid invoice;2 unconfigured gyms,0 invoices, tariff unset, grace7days.
- Existing dashboard totals, monitoring collector and Relayio connection verified after deployment.
- No real financial record or WhatsApp message created during verification.
