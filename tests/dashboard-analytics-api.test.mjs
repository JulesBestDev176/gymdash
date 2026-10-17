import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchDashboardAnalytics } from '../lib/server/dashboard-analytics.ts';
const config = { baseUrl: 'https://api.gympass.minifootapp.com', secret: 'server-secret' };
const request = () => new Request('http://localhost/api/dashboard/analytics', { headers: { Authorization: 'Bearer admin-session', Cookie: 'private-cookie' } });

test('aggregates are requested using the admin session and the server-only secret', async () => {
  const result = await fetchDashboardAnalytics(request(), '90d', config, async (url, options) => {
    assert.equal(String(url), `${config.baseUrl}/api/v1/dashboard/global/analytics?period=90d`);
    assert.equal(new Headers(options.headers).get('Authorization'), 'Bearer admin-session');
    assert.equal(new Headers(options.headers).get('x-gymdash-secret'), 'server-secret');
    assert.equal(new Headers(options.headers).get('Cookie'), null);
    return Response.json({ success: true, data: { period: '90d', range: { label: '90 jours' }, totals: { revenue: 9000, payments: 1, newMembers: 0, entries: 0, activeGyms: 1, members: 2 }, series: [], paymentModes: [], subscriptions: [], gyms: [], generatedAt: new Date().toISOString() } });
  });
  assert.equal(result.status, 200);
  assert.equal((await result.json()).totals.revenue, 9000);
  assert.equal(result.headers.get('Cache-Control'), 'private, no-store');
});
test('invalid periods and absent credentials make no backend request', async () => {
  const never = () => { throw Error('must not fetch'); };
  assert.equal((await fetchDashboardAnalytics(request(), 'all', config, never)).status, 400);
  assert.equal((await fetchDashboardAnalytics(request(), '30d', { ...config, secret: '' }, never)).status, 503);
  assert.equal((await fetchDashboardAnalytics(new Request('http://localhost'), '30d', config, never)).status, 401);
});
test('permission failures are preserved and unavailable datasets are not fabricated', async () => {
  assert.equal((await fetchDashboardAnalytics(request(), '6m', config, async () => Response.json({}, { status: 403 }))).status, 403);
  assert.equal((await fetchDashboardAnalytics(request(), '6m', config, async () => Response.json({}, { status: 404 }))).status, 503);
  const unavailable = await fetchDashboardAnalytics(request(), '6m', config, async () => { throw Error('private backend details'); });
  assert.equal(unavailable.status, 503);
  assert.doesNotMatch(await unavailable.text(), /private backend details/);
  assert.equal((await fetchDashboardAnalytics(request(), '6m', config, async () => Response.json({ period: '6m', totals: {}, series: [] }))).status, 503);
});
