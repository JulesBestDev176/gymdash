# Dashboard analytics

Approved scope: six larger charts, a shared 30-day/90-day/6-month period, and actual network-wide data. Two chart columns collapse to one on small screens. The six views cover revenue, signups, entries, current member states, payment modes, and gym comparison. Gym ranking can switch between revenue, current members, and entries; the top-ten limit and full-network totals are explicit.

`GET /api/dashboard/analytics?period=30d|90d|6m` validates the active administrator session and forwards its JWT to the backend's `/api/v1/dashboard/global/analytics`. `GYMDASH_SECRET` stays on the Next.js server. Configure it to match the backend; `API_INTERNAL_URL` or `NEXT_PUBLIC_API_URL` selects that backend. Responses are private and uncached. Errors display as unavailable, without fabricated zero statistics.

Revenue, payments, signups and entries use one UTC half-open interval. Current members, active gyms and member entitlement states are snapshots, labelled separately in the interface. Backend aggregation zero-fills daily, weekly or monthly buckets and returns grouped counts rather than customer records. No schema migration is needed.

Verification: `node --experimental-strip-types --test tests/dashboard-analytics-api.test.mjs`, `npx.cmd tsc --noEmit`, and the Docker production build. Run `powershell -ExecutionPolicy Bypass -File scripts/verify-dashboard.ps1` to check anonymous rejection, real administrator access and consistency across all three periods. Add `-BaseUrl https://dash.gympass.minifootapp.com` to check the deployed dashboard. The verifier uses the existing documented test administrator and prints aggregate counts only.
