# Gym platform subscriptions and billing — design

User-approved rules: admin records received payments manually; 1 or multiple months; monthly tariff configured in site; block gym operations after a configurable grace period. Billing is for gyms paying GymPass, completely separate from member Payments and GymBro subscriptions. No online processor or real charge is introduced.

## Defaults and safety
Global monthly tariff initially null (must be entered); grace defaults to7 days and is editable0–90. Existing gyms have no billing account and remain NOT_CONFIGURED/unblocked. Recording the first invoice/payment or explicitly enabling a gym opts it into billing. A new enabled unpaid account starts its grace at activation. Disabled accounts are exempt. Configure a monthly-price override per gym or inherit the global price. No fictitious invoices, payments or subscriptions are seeded.

An active subscription covers [coveredFrom,paidUntil). Early renewal appends from max(now,paidUntil). Late renewal starts now. Months mean UTC calendar months, clamped to last valid day (Jan31+1month =>Feb28/29). Grace expires at paidUntil+graceDays (or activation+graceDays before first payment). At that boundary operations are blocked with402. Payment fully settling an invoice restores access immediately. Pending or partially paid invoices never grant extra time.

## Financial records
Settings include issuerName, issuerAddress, issuerEmail, issuerPhone, issuerTaxId and invoiceFooter. Each gym has optional billingName, billingAddress, billingEmail, billingPhone,billingTaxId. Issued invoices snapshot issuer/customer identity and monthly price. Invoice numbers GP-YYYY-000001 use a transactional annual counter; no edit/delete of issued monetary/identity snapshots. Record months1–120, positive integer FCFA, total<=2000000000. Payment totals cannot exceed invoice balance. One or more manual payments (ESPECES,WAVE,ORANGE_MONEY,VIREMENT,CHEQUE,AUTRE) supported. Payments retain reference, paidAt and recordedById. An unpaid invoice can be cancelled with reason; paid/partially paid invoices cannot be cancelled in this initial module. No refund or credit-note invention.

Creation and payment commands require UUID idempotencyKey; duplicate identical requests return the existing result, changed payload with same key409. All payment, invoice status and paidUntil writes are one serializable transaction with bounded conflict retry. Only fully paid invoice grants coverage once. Concurrent different full renewals serialize and append.

## HTTP and data contract
Backend prefix /api/v1/platform-billing; Next proxy /api/billing. API requires JWT+ADMIN+GymDash server secret AND configured GYMDASH_BILLING_ADMIN_EMAILS allowlist. Empty allowlist fails closed. User asked for existing GymDash admin; provision its documented/verified administrator email privately during deployment. Ordinary gym ADMIN roles cannot read cross-gym billing.

GET /overview -> {settings,summary:{collectedFcfa,outstandingFcfa,activeGyms,graceGyms,blockedGyms},gyms:BillingGym[],generatedAt}
GET /invoices?page=1&gymId=&status= -> {items:BillingInvoice[],total,page,pageSize:20}
PATCH /settings -> Settings
PUT /gyms/:gymId -> BillingGym; body {enabled,monthlyPriceFcfa:number|null,billingName?,billingAddress?,billingEmail?,billingPhone?,billingTaxId?}
POST /invoices -> BillingInvoice; body {gymId,months,paid:boolean,mode?,reference?,idempotencyKey}; paid=true records full payment with invoice creation atomically; paid=false creates outstanding invoice. A configured price and issuerName required.
POST /invoices/:id/payments -> BillingInvoice; body {amountFcfa,mode,reference?,paidAt?,idempotencyKey}
POST /invoices/:id/cancel -> BillingInvoice; body {reason}
GET /invoices/:id/pdf -> downloadable application/pdf; private,no-store

Settings={monthlyPriceFcfa:number|null,graceDays:number,issuerName:string,issuerAddress:string,issuerEmail:string,issuerPhone:string,issuerTaxId:string,invoiceFooter:string}
BillingGym={gymId:string,name:string,city:string,status:NOT_CONFIGURED|DISABLED|ACTIVE|GRACE|BLOCKED,enabled:boolean,monthlyPriceFcfa:number|null,priceOverrideFcfa:number|null,paidUntil:string|null,graceEndsAt:string|null,daysRemaining:number|null,outstandingFcfa:number,billingName:string,billingAddress:string,billingEmail:string,billingPhone:string,billingTaxId:string}
BillingInvoice={id,number,gymId,gymName,months,unitPriceFcfa,totalFcfa,paidFcfa,status:UNPAID|PARTIALLY_PAID|PAID|CANCELLED,issuedAt,coveredFrom:string|null,coveredUntil:string|null,issuer:{name,address,email,phone,taxId},customer:{name,address,email,phone,taxId},payments:[{id,amountFcfa,mode,reference:string|null,paidAt:string}],cancellationReason:string|null}

UI page /subscriptions, sidebar Abonnements salles, tabs Salles/Factures/Paramètres. Shared summary cards, search/status gym filtering, explicit current status/paidUntil/grace, create multi-month invoice with already-paid toggle, payment partial/full modal, invoice PDF download, cancellation for unpaid only. Clear errors vs empty; no optimistic money success. Idempotency keys retained for failed/ambiguous retries until successful command or edited financial intent. French formatting and FCFA. Settings editable in site, no env editing for prices.

## Enforcement
Root adds shared access policy and access service. Shared JwtAuthGuard checks billing after JWT authentication for all protected tenant operations, including existing sessions. Login/refresh and account security/me/logout remain accessible so blocked users can see a reason and platform admin can renew. Only verified allowlisted platform ADMIN + correct GymDash secret bypasses restriction on management routes. No secret-only bypass. Standalone GymBro accounts have no gym and are unaffected. Existing manual Gym.statut is not overwritten by billing. Auth/guard failures and DB outages fail closed.

## Verification and rollout
Pure date/status tests, backend real Nest authorization and real PostgreSQL16 disposable fixture tests (invoice uniqueness, transactionality, partial payments, concurrent renewals/idempotency/annual sequence). Access policy boundary/security tests. Frontend tsc+lint+production Docker build. Render a sample PDF with fictitious data to verify layout. Additive migration is rehearsed on local PostgreSQL, never db-push/reset production. Capture a private backup before production migration, retain existing unconfigured access. Backend source deploy via Git; frontend DockerHub/Desktop login. Production verification uses read-only endpoints and rejected invalid input; no real invoice/payment created for tests.
