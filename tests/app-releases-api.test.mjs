import { test } from 'node:test';
import assert from 'node:assert/strict';
import { proxyAppReleases } from '../lib/server/app-releases.ts';
const config = { baseUrl: 'https://backend.example', secret: 'server-only-secret' };
const request = (method = 'GET', body, path = 'admin?cursor=abc&ignored=secret') => new Request(`https://dash.example/api/app-releases/${path}`, { method, headers: { Authorization: 'Bearer real-jwt', ...(body ? { 'Content-Type': 'multipart/form-data; boundary=test' } : {}) }, ...(body ? { body } : {}) });
test('release BFF exposes only fixed routes and requires a bearer session', async () => {
  assert.equal(typeof proxyAppReleases, 'function', 'release BFF must exist');
  const never = () => { throw Error('must not fetch'); };
  assert.equal((await proxyAppReleases(request(), ['..', 'auth'], config, never)).status, 404);
  assert.equal((await proxyAppReleases(new Request('https://dash.example'), ['admin'], config, never)).status, 401);
  assert.equal((await proxyAppReleases(request(), ['admin'], { ...config, secret: '' }, never)).status, 503);
});
test('ordinary ADMIN is denied by authoritative platform guard before any mutation', async () => {
  let calls = 0;
  const result = await proxyAppReleases(request('POST', 'apk bytes'), ['admin'], config, async (url, options) => {
    calls++; assert.equal(options.method, 'GET'); assert.match(url, /app-releases\/admin\?limit=20$/);
    return Response.json({ message: 'Platform admin required' }, { status: 403 });
  });
  assert.equal(result.status, 403); assert.equal(calls, 1);
});
test('listing preserves cursor with page size 20 and forwards server secret only upstream', async () => {
  const result = await proxyAppReleases(request(), ['admin'], config, async (url, options) => {
    assert.equal(url, 'https://backend.example/api/v1/app-releases/admin?limit=20&cursor=abc');
    assert.equal(options.headers.Authorization, 'Bearer real-jwt');
    assert.equal(options.headers['x-gymdash-secret'], config.secret);
    assert.equal(options.headers.Cookie, undefined); assert.equal(options.redirect, 'error');
    return Response.json({ success: true, data: { items: [], nextCursor: null } });
  });
  assert.deepEqual(await result.json(), { items: [], nextCursor: null });
  assert.equal(result.headers.get('Cache-Control'), 'private, no-store');
});
test('multipart draft upload stays multipart and publishing sends once after platform verification', async () => {
  for (const [segments, body] of [[['admin'], 'apk bytes'], [['admin', 'release-1', 'publish'], undefined]]) {
    let calls = 0;
    const response = await proxyAppReleases(request('POST', body), segments, config, async (url, options) => {
      calls++;
      if (calls === 1) return Response.json({ data: { items: [], nextCursor: null } });
      assert.equal(options.method, 'POST');
      if (body) { assert.equal(options.headers['Content-Type'], 'multipart/form-data; boundary=test'); assert.equal(await new Response(options.body).text(), body); }
      else assert.match(url, /release-1\/publish$/);
      return Response.json({ data: { id: 'release-1', status: body ? 'DRAFT' : 'PUBLISHED' } }, { status: 201 });
    });
    assert.equal(response.status, 201); assert.equal(calls, 2);
  }
});
test('access probe reflects platform authorization, oversized uploads and upstream secrets stay private', async () => {
  const access = await proxyAppReleases(request(), ['access'], config, async () => Response.json({ data: { items: [{ secret: 'hidden' }] } }));
  assert.deepEqual(await access.json(), { allowed: true });
  const tooLarge = request('POST', 'apk'); tooLarge.headers.set('Content-Length', String(258 * 1024 * 1024));
  assert.equal((await proxyAppReleases(tooLarge, ['admin'], config, async () => Response.json({}))).status, 413);
  const unavailable = await proxyAppReleases(request(), ['admin'], config, async () => Response.json({ message: config.secret }, { status: 500 }));
  assert.equal(unavailable.status, 503); assert.doesNotMatch(await unavailable.text(), /server-only-secret/);
});
test('latest remains guarded and bodyless GET cannot publish', async () => {
  let calls = 0;
  const response = await proxyAppReleases(request(), ['latest'], config, async (url, options) => {
    calls++; assert.equal(options.method, 'GET');
    assert.equal(url, `https://backend.example/api/v1/app-releases/${calls === 1 ? 'admin?limit=20' : 'android/latest'}`);
    return Response.json({ data: calls === 1 ? { items: [] } : { release: null } });
  });
  assert.deepEqual(await response.json(), { release: null }); assert.equal(calls, 2);
  assert.equal((await proxyAppReleases(request(), ['admin', 'release-1', 'publish'], config, () => { throw Error('must not fetch'); })).status, 405);
});
test('upload streams bounded multipart bytes upstream without collecting the APK in memory', async () => {
  let chunks = 0; let calls = 0; let read = 0;
  const chunk = new Uint8Array(1024 * 1024);
  const stream = new ReadableStream({ pull(controller) { if (chunks++ < 258) controller.enqueue(chunk); else controller.close(); } });
  const upload = new Request('https://dash.example/api/app-releases/admin', { method: 'POST', headers: { Authorization: 'Bearer real-jwt', 'Content-Type': 'multipart/form-data; boundary=test' }, body: stream, duplex: 'half' });
  const result = await proxyAppReleases(upload, ['admin'], config, async (url, options) => {
    calls++;
    if (calls === 1) { assert.equal(chunks <= 1, true, 'must authorize before consuming APK'); return Response.json({ data: { items: [] } }); }
    assert.equal(options.duplex, 'half');
    assert.ok(options.body instanceof ReadableStream);
    const reader = options.body.getReader();
    while (true) { const part = await reader.read(); if (part.done) break; read += part.value.byteLength; }
    return Response.json({ data: { id: 'should-not-be-created' } });
  });
  assert.equal(result.status, 413); assert.equal(calls, 2);
  assert.ok(read <= 257 * 1024 * 1024);
});
