import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serviceState, thresholdAlerts } from '../lib/monitoring-model.ts';

test('running unknown is healthy only after a successful HTTP probe', () => {
  assert.equal(serviceState('running:unknown', true), 'up');
  assert.equal(serviceState('running:unknown', null), 'degraded');
  assert.equal(serviceState('running:healthy', false), 'down');
  assert.equal(serviceState('stopped', true), 'down');
});
test('missing resource metrics never produce fake healthy zeroes', () => {
  assert.deepEqual(thresholdAlerts(null, []), []);
});
test('thresholds generate resource and real API alerts', () => {
  const alerts = thresholdAlerts({ cpuPercent: 91, memoryPercent: 50, diskPercent: 89 }, [
    { method: 'GET', route: '/api/v1/gyms', count: 100, p95Ms: 1500, errorRate: 0.1 },
  ]);
  assert.ok(alerts.some(a => a.id === 'cpu'));
  assert.ok(alerts.some(a => a.id === 'disk'));
  assert.ok(alerts.some(a => a.id.startsWith('latency:')));
  assert.ok(alerts.some(a => a.id.startsWith('errors:')));
  assert.ok(!alerts.some(a => a.id === 'memory'));
});
