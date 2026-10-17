import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { requireAdmin } from '../lib/server/admin-auth.ts';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const request = () => new Request('http://localhost/api/monitoring', { headers: { Authorization: 'Bearer session-token' } });

test('anonymous requests are refused without calling the backend', async () => {
  globalThis.fetch = () => { throw new Error('must not fetch'); };
  assert.equal((await requireAdmin(new Request('http://localhost'))).status, 401);
});
test('validates token with existing backend and accepts an active admin', async () => {
  globalThis.fetch = async (url, options) => {
    assert.ok(String(url).endsWith('/api/v1/auth/me'));
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer session-token');
    return Response.json({ success: true, data: { user: { role: 'ADMIN', actif: true } } });
  };
  assert.equal(await requireAdmin(request()), null);
});
test('non-admin users are forbidden', async () => {
  globalThis.fetch = async () => Response.json({ data: { user: { role: 'GERANT' } } });
  assert.equal((await requireAdmin(request())).status, 403);
});
test('expired JWT stays unauthorized', async () => {
  globalThis.fetch = async () => new Response('', { status: 401 });
  assert.equal((await requireAdmin(request())).status, 401);
});
test('backend failure is unavailable, never permission granted', async () => {
  globalThis.fetch = async () => { throw new Error('network'); };
  assert.equal((await requireAdmin(request())).status, 503);
});
