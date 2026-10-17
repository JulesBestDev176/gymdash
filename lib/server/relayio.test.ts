import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error Node executes this TypeScript import directly in the contract tests.
import { createRelayio, normalizeMessage } from './relayio.ts';

const config = { baseUrl: 'https://relay.example/v1/', apiKey: 'test-key', sessionId: '' };
const session = { id: 'ses_one', _id: 'mongo-id', name: 'Loyalty', status: 'READY', phoneNumber: '' };
const reply = (value: unknown, status = 200) => Response.json(value, { status });

test('missing credentials makes no upstream request', async () => {
  const client = createRelayio({ ...config, apiKey: '' }, async () => { throw Error('must not fetch'); });
  assert.equal((await client.snapshot()).configured, false);
});

test('history returns only outgoing messages and excludes incoming messages from counts', async () => {
  const calls: string[] = [];
  const client = createRelayio(config, async (input, init) => {
    calls.push(String(input));
    assert.equal(new Headers(init?.headers).get('x-api-key'), 'test-key');
    assert.equal(new Headers(init?.headers).get('Authorization'), null);
    return calls.length === 1 ? reply([session]) : reply([
      { _id: 'db-message', direction: 'inbound', status: 'delivered', body: null, hasMedia: true, chatId: 'test@c.us', timestamp: '2026-10-17T10:00:00Z' },
      { id: 'sent-message', direction: 'outbound', status: 'sent', body: 'fixture', to: 'test@c.us' },
      { id: 'pending-message', direction: 'outbound', status: 'queued', body: 'pending', to: 'test@c.us' },
      { id: 'failed-message', direction: 'outbound', status: 'failed', body: 'failed', to: 'test@c.us' },
    ]);
  });
  const result = await client.snapshot();
  assert.deepEqual(calls, ['https://relay.example/v1/sessions', 'https://relay.example/v1/sessions/ses_one/messages']);
  assert.equal(result.connected, true);
  assert.equal(result.channel?.name, 'Loyalty');
  assert.deepEqual(result.messages.map(message => message.id), ['sent-message', 'pending-message', 'failed-message']);
  assert.equal(result.stats.total, 3);
  assert.equal(result.stats.sent, 1);
  assert.equal(result.stats.pending, 1);
  assert.equal(result.stats.failed, 1);
  assert.equal('received' in result.stats, false);
  assert.doesNotMatch(JSON.stringify(result), /db-message|test@inbound/);
  assert.equal(result.historyScope, 'fetched');
});

test('sent-only upstream responses without direction remain visible, received status stays excluded', async () => {
  let count = 0;
  const client = createRelayio(config, async () => ++count === 1 ? reply([session]) : reply([
    { id: 'legacy-outgoing', status: 'delivered', to: 'recipient@c.us' },
    { id: 'explicit-received', status: 'received', from: 'private-inbound' },
  ]));
  const result = await client.snapshot();
  assert.deepEqual(result.messages.map(message => message.id), ['legacy-outgoing']);
  assert.equal(result.stats.sent, 0);
  assert.equal(result.stats.delivered, 1);
  assert.doesNotMatch(JSON.stringify(result), /private-inbound/);
});

test('multiple sessions require explicit selection; configured Mongo id resolves canonical session id', async () => {
  const many = [session, { ...session, id: 'ses_two', _id: 'mongo-two' }];
  const client = createRelayio(config, async () => reply(many));
  assert.equal((await client.snapshot()).state, 'session_required');
  const urls: string[] = [];
  const selected = createRelayio({ ...config, sessionId: 'mongo-id' }, async (input) => {
    urls.push(String(input));
    return reply(urls.length === 1 ? many : []);
  });
  assert.equal((await selected.snapshot()).connected, true);
  assert.match(urls[1], /ses_one\/messages$/);
});

test('authentication failures and unavailable history retain honest state', async () => {
  const auth = await createRelayio(config, async () => reply({ secret: 'must not leak' }, 401)).snapshot();
  assert.equal(auth.state, 'auth_error');
  assert.equal(auth.configured, true);
  assert.doesNotMatch(JSON.stringify(auth), /must not leak/);
  let count = 0;
  const partial = await createRelayio(config, async () => ++count === 1 ? reply([session]) : reply({}, 503)).snapshot();
  assert.equal(partial.connected, true);
  assert.equal(partial.historyAvailable, false);
  assert.equal(partial.state, 'upstream_error');
});

test('disconnected sessions cannot send and malformed upstream schemas are errors', async () => {
  const client = createRelayio(config, async () => reply([{ ...session, status: 'DISCONNECTED' }]));
  await assert.rejects(client.send({ to: '+221770000000', body: 'fixture' }), /reconnecter/);
  assert.equal((await createRelayio(config, async () => reply({ unexpected: [] })).snapshot()).state, 'upstream_error');
});

test('send uses required chatId text contract with normalized phone, mocked only', async () => {
  let count = 0;
  const client = createRelayio(config, async (input, init) => {
    if (++count === 1) return reply([session]);
    assert.equal(String(input), 'https://relay.example/v1/sessions/ses_one/messages/text');
    assert.equal(init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(init?.body)), { chatId: '221770000000@s.whatsapp.net', body: 'fixture' });
    return reply({ id: 'queued-message', status: 'queued' }, 201);
  });
  assert.equal((await client.send({ to: '+221 77 000 00 00', body: 'fixture' })).status, 'pending');
  await assert.rejects(client.send({ to: 'invalid', body: 'fixture' }), /international/);
  await assert.rejects(client.send({ to: '+221770000000', body: ' ' }), /message/);
});

test('unknown outbound status stays unknown, not failed', () => {
  assert.equal(normalizeMessage({ id: 'x', direction: 'outbound', status: 'new_status' }).status, 'unknown');
});

test('delivery receipts remain distinct from sent without delivery confirmation', () => {
  assert.equal(normalizeMessage({ id: 'a', status: 'sent' }).status, 'sent');
  assert.equal(normalizeMessage({ id: 'b', status: 'delivered' }).status, 'delivered');
  assert.equal(normalizeMessage({ id: 'c', status: 'read' }).status, 'read');
});

test('a successful HTTP response cannot hide a failed or malformed send', async () => {
  for (const payload of [{ id: 'failed', status: 'failed' }, {}, null]) {
    let count = 0;
    const client = createRelayio(config, async () => ++count === 1 ? reply([session]) : reply(payload, 201));
    await assert.rejects(client.send({ to: '+221770000000', body: 'fixture' }), /confirm|échoué/);
    assert.equal(count, 2, 'never retry a send automatically');
  }
});

test('missing selected session and transport errors are actionable and sanitized', async () => {
  const missing = await createRelayio({ ...config, sessionId: 'missing' }, async () => reply([session])).snapshot();
  assert.equal(missing.state, 'session_missing');
  assert.equal(missing.connected, false);
  const unavailable = await createRelayio(config, async () => { throw Error('sensitive upstream URL'); }).snapshot();
  assert.equal(unavailable.state, 'upstream_error');
  assert.equal(unavailable.historyAvailable, false);
  assert.doesNotMatch(JSON.stringify(unavailable), /sensitive/);
});
