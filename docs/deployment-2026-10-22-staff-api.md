# Backend staff API deployment - 2026-10-22

Issue: production returned 404 for PATCH /api/v1/users/admin/:id/contact because Coolify ran release/gymbro-exercise-catalog-20261017 at 9944d52.

Published isolated backend branch release/gympass-staff-20261022, commit 18edc7d701634c71e708838202c90bd04799c437. Coolify deployment vvcqtsl9iwnlyymfq9hhvizd finished successfully and removed the old container. Final application status running:healthy.

Backup: qtxrkx2wdilmywxfs5nxolda, execution ihvwuufttanzlgezjosgpqth, success, 103079 bytes.

Only staff contact/authentication changes and the User schema block were included. Startup applies the reviewed transactional staff recovery SQL, records its Prisma migration and skips all unrelated historical migrations and seeds. No accounts were deleted or merged.

Validation: backend build passed; 57 tests passed. Public health returned HTTP 200/status ok. PATCH /users/admin/deployment-check/contact and POST /users/admin/deployment-check/reset-password now return HTTP 401 from GymDashGuard without credentials, proving both routes are installed. Verification made no real contact changes or WhatsApp sends. Live read-only audit succeeded: six staff, no duplicate phones, three legacy accounts still need a valid phone.

Read-only diagnostic task p96rysw2mh1kve5wg3cyyf9q remains disabled; its last command is node scripts/audit-staff-phones.cjs. One-shot backup schedule is disabled.

Rollback if needed: restore branch release/gymbro-exercise-catalog-20261017 and commit 9944d52 in Coolify; retain additive staff columns and phone index. The original working tree on main was preserved.
