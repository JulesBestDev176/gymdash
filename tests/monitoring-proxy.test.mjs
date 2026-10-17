import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proxyDevelopmentMonitoring } from '../lib/server/monitoring-proxy.ts';

const config = { environment: 'development', url: 'https://dash.gympass.minifootapp.com/api/monitoring' };
const request = () => new Request('http://localhost:3000/api/monitoring', {
  headers: { Authorization: 'Bearer admin-jwt', Cookie: 'local-only=private', 'x-collector-token': 'never-forward' },
});

test('local monitoring reads the deployed API over HTTPS with only the user session', async () => {
  const snapshot = { metrics: { server: { cpuPercent: 15 }, storage: [{ name: 'postgres' }] }, partialErrors: [] };
  const response = await proxyDevelopmentMonitoring(request(), 168, config, async (url, options) => {
    assert.equal(String(url), `${config.url}?hours=168`);
    const headers = new Headers(options.headers);
    assert.equal(headers.get('Authorization'), 'Bearer admin-jwt');
    assert.equal(headers.get('Cookie'), null);
    assert.equal(headers.get('x-collector-token'), null);
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    return Response.json(snapshot);
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), snapshot);
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
});
test('production keeps its private collector and never calls the development proxy', async () => {
  assert.equal(await proxyDevelopmentMonitoring(request(), 24, { ...config, environment: 'production' }, () => { throw Error('must not fetch'); }), null);
});
test('unset proxy retains normal monitoring behavior', async () => {
  assert.equal(await proxyDevelopmentMonitoring(request(), 24, { environment: 'development' }, () => { throw Error('must not fetch'); }), null);
});
test('no anonymous request can use the proxy', async () => {
  const result = await proxyDevelopmentMonitoring(new Request('http://localhost:3000'), 24, config, () => { throw Error('must not fetch'); });
  assert.equal(result.status, 401);
});
test('insecure targets, credentials and self-proxy loops are rejected', async () => {
  for (const url of ['http://dash.gympass.minifootapp.com/api/monitoring', 'https://user:secret@example.com/api/monitoring', 'https://example.com/wrong-path']) {
    const result = await proxyDevelopmentMonitoring(request(), 24, { ...config, url }, () => { throw Error('must not fetch'); });
    assert.equal(result.status, 503);
  }
  const result = await proxyDevelopmentMonitoring(new Request(config.url, { headers: { Authorization: 'Bearer jwt' } }), 24, config, () => { throw Error('must not fetch'); });
  assert.equal(result.status, 503);
});
test('expired sessions and unavailable production API stay explicit failures', async () => {
  const expired = await proxyDevelopmentMonitoring(request(), 24, config, async () => Response.json({ error: 'Session expirée' }, { status: 401 }));
  assert.equal(expired.status, 401);
  const unavailable = await proxyDevelopmentMonitoring(request(), 24, config, async () => { throw Error('secret network details'); });
  assert.equal(unavailable.status, 503);
  assert.doesNotMatch(await unavailable.text(), /secret network details/);
});
