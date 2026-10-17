import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node executes TypeScript imports directly.
import { proxyExercises } from './exercises.ts';

const config = { baseUrl: 'https://backend.test', secret: 'server-secret' };
const req = (method = 'GET', body?: string, url = 'https://dashboard.test/api/exercises/admin/catalog') => new Request(url, { method, headers: { Authorization: 'Bearer admin-jwt' }, body });

test('catalog forwards only supported filters with server credentials and no cache', async () => {
  const response = await proxyExercises(req('GET', undefined, 'https://dashboard.test/api/exercises/admin/catalog?q=squat&page=2&hasAnimation=false&secret=evil'), ['admin', 'catalog'], config, async (url, init) => {
    assert.equal(String(url), 'https://backend.test/api/v1/gymbro/exercises/admin/catalog?q=squat&page=2&hasAnimation=false');
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer admin-jwt');
    assert.equal(new Headers(init?.headers).get('x-gymdash-secret'), 'server-secret');
    assert.equal(init?.cache, 'no-store');
    return Response.json({ data: { items: [], total: 0 } });
  });
  assert.deepEqual(await response.json(), { items: [], total: 0 });
  assert.match(response.headers.get('cache-control')!, /no-store/);
});

test('unlisted paths, methods and missing credentials never reach backend', async () => {
  const never = async () => { throw Error('unexpected backend call'); };
  assert.equal((await proxyExercises(req(), ['admin', '..', 'auth'], config, never)).status, 404);
  assert.equal((await proxyExercises(req('POST', '{}'), ['admin', 'all'], config, never)).status, 405);
  assert.equal((await proxyExercises(new Request('https://dashboard.test'), ['admin', 'all'], config, never)).status, 401);
  assert.equal((await proxyExercises(req(), ['admin', 'all'], { ...config, secret: '' }, never)).status, 503);
});

test('mutations accept bounded JSON objects and reject invalid or oversized streams', async () => {
  const never = async () => { throw Error('unexpected backend call'); };
  for (const body of ['null', '[]', 'invalid']) assert.equal((await proxyExercises(req('POST', body), ['admin', 'import'], config, never)).status, 400);
  assert.equal((await proxyExercises(req('POST', JSON.stringify({ nomFr: 'é'.repeat(18000) })), ['admin'], config, never)).status, 413);
  const result = await proxyExercises(req('PATCH', '{"reviewed":true}'), ['admin', 'exercise-1', 'toggle'], config, async (_url, init) => {
    assert.equal(init?.body, '{"reviewed":true}');
    return Response.json({ id: 'exercise-1', actif: true });
  });
  assert.equal((await result.json()).actif, true);
});

test('upstream secrets and exceptions are hidden; failed mutations are never retried', async () => {
  let calls = 0;
  const response = await proxyExercises(req('POST', '{}'), ['admin', 'import'], config, async () => { calls++; throw Error('server-secret'); });
  assert.equal(calls, 1);
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /server-secret/);
  const failure = await proxyExercises(req(), ['admin', 'all'], config, async () => Response.json({ message: 'server-secret' }, { status: 500 }));
  assert.doesNotMatch(await failure.text(), /server-secret/);
});
