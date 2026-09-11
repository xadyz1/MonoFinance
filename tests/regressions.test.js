const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const appSource = read('app.js');

// Exercise the real Express routes with an isolated database/storage adapter.
async function backend(t, failTable = null) {
  const calls = [];
  const user = { id: 7, email: 'test@example.com', name: 'Ana', role: 'admin', avatar_url: 'https://cdn.example/avatar.png' };
  const tx = { id: '1789000000000', receipt_url: 'https://cdn.example/receipt.pdf' };
  const rows = {
    swiftfinance_users: user,
    swiftfinance_user_data: { user_id: 7, transactions: [tx] },
    swiftfinance_plans: [{ id: 1, name: 'Plano existente', price: '4.99', features: ['Recibos'], active: true }],
    swiftfinance_receipts: { id: 12 },
    swiftfinance_advertising: { id: 1 }
  };
  const supabase = { schema: () => ({ from: table => {
    const call = { table, filters: [] };
    calls.push(call);
    const query = {};
    for (const method of ['select', 'single', 'maybeSingle', 'order', 'limit', 'ilike']) query[method] = () => query;
    query.eq = (key, value) => { call.filters.push([key, value]); return query; };
    for (const method of ['insert', 'update', 'delete']) query[method] = payload => { call.method = method; call.payload = payload; return query; };
    query.then = resolve => resolve({ data: table === failTable ? null : rows[table], error: table === failTable ? { message: 'Simulated database failure' } : null });
    return query;
  } }) };
  const context = vm.createContext({
    require: name => {
      if (name === 'dotenv') return { config() {} };
      if (name === '@supabase/supabase-js') return { createClient: () => supabase };
      if (name === 'node-cron') return { schedule() {} };
      if (name === 'express-session') return () => (req, res, next) => { req.session = { userId: 7, username: user.email }; next(); };
      return require(name);
    },
    process: { env: { BUNNY_STORAGE_ENDPOINT: 'https://storage.example/zone/', BUNNY_PULL_ZONE: 'https://cdn.example/', BUNNY_API_KEY: 'test' } },
    __dirname: root, Buffer, console: { log() {}, error() {} },
    fetch: async url => { calls.push({ upload: url }); return { ok: true, status: 201 }; }
  });
  const source = read('server.js').replace('seedInitialData().catch(console.error);', '')
    .replace(/app\.listen\(PORT,[^\n]+/, '');
  vm.runInContext(source, context);
  const app = vm.runInContext('app', context);
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = (endpoint, options) => fetch(`http://127.0.0.1:${server.address().port}${endpoint}`, options);
  return { request, calls, tx };
}

test('profile API returns the stored name and avatar', async t => {
  const { request } = await backend(t);
  const response = await request('/api/me');
  assert.equal(response.status, 200);
  const user = await response.json();
  assert.equal(user.name, 'Ana');
  assert.equal(user.avatar_url, 'https://cdn.example/avatar.png');
});

test('public and admin plan lists use the expected contract', async t => {
  const { request, calls } = await backend(t);
  for (const endpoint of ['/api/plans', '/api/admin/plans']) {
    const response = await request(endpoint);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).plans[0].name, 'Plano existente');
  }
  const queries = calls.filter(c => c.table === 'swiftfinance_plans');
  assert.deepEqual(queries[0].filters, [['active', true]]);
  assert.deepEqual(queries[1].filters, []);
});

test('database errors are not disguised as empty plan lists or successful saves', async t => {
  const { request } = await backend(t, 'swiftfinance_plans');
  assert.equal((await request('/api/plans')).status, 500);
  const dataBackend = await backend(t, 'swiftfinance_user_data');
  assert.equal((await dataBackend.request('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 500);
});

test('receipt URLs survive loading and saving transaction JSON', async t => {
  const { request, calls, tx } = await backend(t);
  const loaded = await (await request('/api/data')).json();
  assert.deepEqual(loaded.transactions, [tx]);
  const response = await request('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transactions: [tx] }) });
  assert.equal(response.status, 200);
  assert.equal(calls.find(c => c.table === 'swiftfinance_user_data' && c.method === 'update').payload.transactions[0].receipt_url, tx.receipt_url);
});

test('receipt upload normalizes CDN URLs and reports failed database inserts', async t => {
  for (const failure of [null, 'swiftfinance_receipts']) {
    const { request, calls } = await backend(t, failure);
    const response = await request('/api/upload-receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'receipt.pdf', file: 'dGVzdA==' }) });
    assert.equal(response.status, failure ? 500 : 200);
    if (!failure) assert.match((await response.json()).url, /^https:\/\/cdn\.example\/\d+_receipt\.pdf$/);
    assert.match(calls.find(c => c.upload).upload, /^https:\/\/storage\.example\/zone\/\d+_receipt\.pdf$/);
  }
});

test('avatar upload persists the public URL for the authenticated user', async t => {
  const { request, calls } = await backend(t);
  const body = new FormData();
  body.append('file', new Blob(['test'], { type: 'image/png' }), 'avatar.png');
  const response = await request('/api/upload-avatar', { method: 'POST', body });
  assert.equal(response.status, 200);
  const { url } = await response.json();
  const update = calls.find(c => c.table === 'swiftfinance_users' && c.method === 'update');
  assert.equal(update.payload.avatar_url, url);
  assert.deepEqual(update.filters, [['id', 7]]);
  assert.match(url, /^https:\/\/cdn\.example\/\d+_avatar_avatar\.png$/);
});

test('frontend hydrates and renders profile information and supports cleared names', async () => {
  const welcomeName = {}, welcomeAvatar = {}, preview = {};
  const context = vm.createContext({ welcomeName, welcomeAvatar, document: { getElementById: id => id === 'settings-avatar-preview' ? preview : null },
    currentUserName: '', currentUserAvatar: '', currentUserRole: '', currentUser: '',
    fetch: async () => ({ ok: true, json: async () => ({ username: 'test@example.com', name: 'Ana', avatar_url: 'https://cdn.example/avatar.png', role: 'user' }) }),
    getApiUrl: x => x, showAppScreenSmoothly() {}, fetchUserData: async () => {},
    userInfoSection: null, currentUsernameDisplay: null, btnImportLocal: null, btnLogout: null,
    showAuthScreen() { throw new Error('Unexpected authentication fallback'); }, console
  });
  // Only compile the actual functions under test; do not run unrelated chart/UI initializers.
  vm.runInContext(appSource.slice(appSource.indexOf('    function updateWelcomeSection()'), appSource.indexOf('    // DOM Elements - Metrics')), context);
  vm.runInContext(appSource.slice(appSource.indexOf('    async function checkAuth()'), appSource.indexOf('    function showAuthScreen()')), context);
  await vm.runInContext('checkAuth()', context);
  assert.equal(welcomeName.textContent, 'Ana');
  assert.equal(welcomeAvatar.src, 'https://cdn.example/avatar.png');
  vm.runInContext("currentUserName = ''; updateWelcomeSection();", context);
  assert.equal(welcomeName.textContent, 'test@example.com');
});

test('receipt links reject executable URLs and remain separate from truncated descriptions', () => {
  const context = vm.createContext({ URL, window: { location: { origin: 'https://app.example' } } });
  vm.runInContext(appSource.slice(appSource.indexOf('    const escapeHtml'), appSource.indexOf('    // Auth and Sync')), context);
  assert.equal(vm.runInContext("receiptIconHtml('javascript:alert(1)')", context), '');
  assert.match(vm.runInContext("receiptIconHtml('https://cdn.example/receipt.pdf')", context), /aria-label="Ver recibo"/);
  assert.equal(appSource.split('<span class="min-w-0 truncate">${escapeHtml(t.description)}</span>${receiptIconHtml(t.receipt_url)}').length - 1, 8);
});

test('landing renders stored plans with JSON features and escapes their text', async () => {
  const grid = { innerHTML: '' };
  const modal = { addEventListener() {} };
  const context = vm.createContext({ console, window: { location: { origin: 'https://app.example' } },
    document: { getElementById: id => id === 'plans-grid' ? grid : modal, querySelectorAll: () => [] },
    fetch: async url => ({ ok: true, json: async () => url.endsWith('/api/plans') ? { plans: [
      { name: 'Plano existente', price: '4.99', features: ['<script>unsafe</script>'], active: true },
      { name: 'Inativo', price: 0, active: false }
    ] } : { active: false } })
  });
  vm.runInContext(read('landing.js'), context);
  await new Promise(resolve => setImmediate(resolve));
  assert.match(grid.innerHTML, /Plano existente/);
  assert.match(grid.innerHTML, /4\.99/);
  assert.match(grid.innerHTML, /&lt;script&gt;/);
  assert.doesNotMatch(grid.innerHTML, /Inativo|<script>/);
});

test('HTML labels and cache versions are consistent; API data is never cached', () => {
  const html = read('app.html');
  const sw = read('sw.js');
  assert.doesNotMatch(html, /[\u0400-\u04ff]/);
  for (const asset of ['app.js?v=136', 'styles.css?v=114']) {
    assert.ok(html.includes(asset));
    assert.ok(sw.includes(asset));
  }
  assert.ok(sw.includes("url.pathname.startsWith('/api/')"));
  assert.ok(appSource.includes("method: payload.id ? 'PUT' : 'POST'"));
});