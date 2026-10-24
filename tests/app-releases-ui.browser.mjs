// UI contract smoke check against a locally running dashboard; all release endpoints are fixtures.
import { chromium } from '../../.tmp/exercise-browser/node_modules/playwright/index.mjs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const base = process.env.RELEASE_TEST_URL || 'http://localhost:3017';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const draft = { id: 'draft-2', versionName: '1.2.0', versionCode: 12, packageName: 'com.gympass.gympass_sn', notes: 'Correction synchronisation', sha256: 'a'.repeat(64), sizeBytes: 1024, status: 'DRAFT', createdAt: '2026-10-23T12:00:00Z', publishedAt: null, apkUrl: null };
let browser;
(async () => {
  browser = await chromium.launch({ headless: true, executablePath: path.join(root, '.tmp/exercise-browser/browsers/chromium-1248/chrome-win64/chrome.exe') });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
  await context.addInitScript(() => localStorage.setItem('gymdash_token', 'fixture-token'));
  const page = await context.newPage(); const errors = []; const mutations = []; const cursors = [];
  page.setDefaultTimeout(90_000); page.setDefaultNavigationTimeout(180_000);
  let active = null; let uploaded = false; let denied = true; let unavailable = false;
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/app-releases/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const endpoint = url.pathname.replace('/api/app-releases/', '');
    if (endpoint === 'access') return route.fulfill({ status: unavailable ? 503 : denied ? 403 : 200, json: unavailable ? { error: 'Unavailable' } : denied ? { error: 'Platform admin required' } : { allowed: true } });
    assert.equal(denied, false);
    if (request.method() === 'POST') mutations.push(endpoint);
    if (endpoint === 'latest') return route.fulfill({ json: { release: active } });
    if (endpoint === 'admin' && request.method() === 'POST') {
      assert.match(request.headers()['content-type'], /multipart\/form-data; boundary=/);
      assert.match(request.postDataBuffer().toString(), /Notes test/);
      uploaded = true; return route.fulfill({ status: 201, json: draft });
    }
    if (endpoint === 'admin/draft-2/publish') {
      active = { ...draft, status: 'PUBLISHED', publishedAt: '2026-10-23T13:00:00Z' };
      return route.fulfill({ json: active });
    }
    assert.equal(endpoint, 'admin'); cursors.push(url.searchParams.get('cursor'));
    return route.fulfill({ json: { items: uploaded ? [active || draft] : [], nextCursor: uploaded ? null : url.searchParams.has('cursor') ? null : 'cursor-page-two' } });
  });
  await page.goto(`${base}/app-releases`); await page.getByRole('heading', { name: 'Accès réservé à la plateforme' }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Versions Android' }).count(), 0);
  assert.deepEqual(mutations, []);
  denied = false; unavailable = true; await page.reload();
  await page.getByRole('alert').filter({ hasText: 'Impossible de vérifier votre accès.' }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Versions Android', exact: true }).count(), 1, 'APK menu remains discoverable while the service is unavailable');
  assert.deepEqual(mutations, []);
  unavailable = false; await page.reload(); await page.getByRole('heading', { name: 'Versions GymPass' }).waitFor();
  await page.getByText('Aucune version publiée.', { exact: true }).waitFor();
  await page.getByRole('link', { name: 'Versions Android' }).waitFor(); assert.deepEqual(mutations, []);
  await page.getByRole('button', { name: 'Suivant', exact: true }).click(); await page.getByText('Page 2', { exact: true }).waitFor();
  assert.ok(cursors.includes('cursor-page-two'));
  await page.getByLabel('Fichier APK', { exact: true }).setInputFiles({ name: 'fixture.apk', mimeType: 'application/vnd.android.package-archive', buffer: Buffer.from('fixture-ui-only') });
  await page.getByLabel('Notes de version', { exact: true }).fill('Notes test');
  await page.getByRole('button', { name: 'Importer le brouillon', exact: true }).click();
  await page.getByRole('button', { name: 'Publier', exact: true }).waitFor(); assert.deepEqual(mutations, ['admin']);
  await page.getByText('Détails et notes', { exact: true }).click(); await page.getByText(draft.sha256, { exact: true }).waitFor();
  page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('button', { name: 'Publier', exact: true }).click();
  assert.deepEqual(mutations, ['admin']);
  page.once('dialog', dialog => { assert.match(dialog.message(), /code 12/); return dialog.accept(); });
  await page.getByRole('button', { name: 'Publier', exact: true }).click(); await page.getByText('Version active', { exact: true }).waitFor();
  assert.deepEqual(mutations, ['admin', 'admin/draft-2/publish']);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ passed: true, checks: ['platform denial/menu guard', 'APK menu visible during service outage', 'no load mutation', 'cursor pages', 'multipart upload/notes', 'draft metadata', 'cancel and confirm publication', 'latest refresh', 'mobile overflow'], mutations }));
  await browser.close();
})().catch(async error => { console.error(error); await browser?.close(); process.exitCode = 1; });
