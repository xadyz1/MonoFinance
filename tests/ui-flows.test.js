const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.resolve(__dirname, '..', name), 'utf8');

function dom() {
  const elements = new Map();
  const document = {
    listeners: {}, activeElement: null,
    addEventListener(name, callback) { this.listeners[name] = callback; },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, element());
      return elements.get(id);
    },
    createElement: tag => element(tag),
    querySelectorAll: () => []
  };
  function element(tag = 'div') {
    const classes = new Set();
    return {
      tag, children: [], listeners: {}, style: {}, attributes: {}, isConnected: true, textContent: '',
      classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) },
      addEventListener(name, callback) { this.listeners[name] = callback; },
      appendChild(child) { this.children.push(child); },
      replaceChildren() { this.children.forEach(child => { child.isConnected = false; }); this.children = []; },
      setAttribute(name, value) { this.attributes[name] = value; },
      removeAttribute(name) { delete this[name]; },
      focus() { document.activeElement = this; }
    };
  }
  document.body = element('body');
  return { document, element };
}

test('ad sections precede the final CTA and sit outside the welcome card', () => {
  const landing = read('index.html');
  assert.ok(landing.indexOf('id="landing-ad-section"') < landing.indexOf('<section class="final">'));
  assert.equal(landing.split('id="landing-ad-slot"').length - 1, 1);
  assert.match(landing, /<section id="landing-ad-section"[^>]*class="ad-section"/);
  assert.match(landing, /<div class="ad-card">/);
  assert.match(landing, /<div class="ad-label">/);
  assert.doesNotMatch(landing + read('landing.js'), /buy-button\.js|buy_btn_swiftfinance_|pk_live_REPLACE/);
  const app = read('app.html');
  assert.match(app, /<\/div>\s*<\/div>\s*<section id="dashboard-ad-section" class="hidden w-full min-w-0"/);
  assert.ok(app.indexOf('id="dashboard-ad-section"') < app.indexOf('<!-- Metric Cards row -->'));
});

test('dashboard ad fills its independent section and is revealed only when active', async () => {
  for (const active of [true, false]) {
    const { document } = dom();
    const section = document.getElementById('dashboard-ad-section');
    section.classList.add('hidden');
    vm.runInNewContext(read('dashboard.js'), { document, console, window: { location: { origin: 'https://app.example' } },
      fetch: async () => ({ ok: true, json: async () => ({ active, html: '<p>Anúncio</p>' }) }) });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(section.classList.contains('hidden'), !active);
    if (active) assert.equal(document.getElementById('dashboard-ad-slot').innerHTML, '<p>Anúncio</p>');
  }
});

test('landing subscription redirects to checkout, preserves login choice and shows errors', async () => {
  for (const responseStatus of [200, 502]) {
    const { document } = dom();
    const button = document.createElement('button');
    button.dataset = { priceId: 'price_real123', free: 'false' };
    document.querySelectorAll = () => [button];
    const calls = [];
    const window = { location: { origin: 'https://app.example', search: '', href: '' } };
    vm.runInNewContext(read('landing.js'), { document, window, URL, URLSearchParams, console,
      fetch: async (url, options) => {
        calls.push({ url, options });
        if (url.endsWith('/api/plans')) return { ok: true, json: async () => ({ plans: [{ name: 'Pro', price: 5, active: true }] }) };
        if (url.includes('/api/ads')) return { ok: true, json: async () => ({ active: false }) };
        return { ok: responseStatus === 200, status: responseStatus, json: async () => ({ url: 'https://checkout.stripe.com/c/pay/cs_test_123', message: 'Preço não configurado' }) };
      }
    });
    await new Promise(resolve => setImmediate(resolve));
    button.listeners.click();
    await new Promise(resolve => setImmediate(resolve));
    // Fill the modal form before submitting
    document.getElementById('subscribe-name').value = 'Ana';
    document.getElementById('subscribe-email').value = 'ana@example.com';
    document.getElementById('subscribe-form').listeners.submit({ preventDefault() {} });
    await new Promise(resolve => setImmediate(resolve));
    const checkoutCall = calls.find(c => c.options && c.options.method === 'POST' && c.url.includes('/api/create-checkout-session'));
    assert.ok(checkoutCall, 'expected a create-checkout-session call');
    assert.equal(JSON.parse(checkoutCall.options.body).priceId, 'price_real123');
    if (responseStatus === 200) assert.equal(window.location.href, 'https://checkout.stripe.com/c/pay/cs_test_123');
    if (responseStatus === 502) {
      assert.equal(window.location.href, '');
      assert.equal(document.getElementById('subscribe-error').textContent, 'Preço não configurado');
    }
  }
});

test('login returns to the selected plan, never an arbitrary external URL', async () => {
  const source = read('login.html').match(/<script>\s*const \$[\s\S]*?<\/script>/)[0].replace(/<\/?script>/g, '');
  const { document } = dom();
  document.getElementById('username').value = 'user@example.com';
  document.getElementById('password').value = 'test';
  const window = { location: { search: '?checkout=price_real123' } };
  vm.runInNewContext(source, { document, window, URLSearchParams, fetch: async () => ({ ok: true, json: async () => ({}) }) });
  await document.getElementById('auth-form').listeners.submit({ preventDefault() {} });
  assert.equal(window.location.href, '/?checkout=price_real123#pricing');
});

test('landing resumes checkout once after login and removes the query parameter', async () => {
  const { document } = dom();
  const historyCalls = [];
  const checkoutCalls = [];
  const window = {
    location: { origin: 'https://app.example', pathname: '/', search: '?checkout=price_real123', href: '' },
    history: { replaceState: (...args) => historyCalls.push(args) }
  };
  vm.runInNewContext(read('landing.js'), { document, window, URL, URLSearchParams, console,
    fetch: async (url, options) => {
      if (options) {
        checkoutCalls.push(options);
        return { ok: true, status: 200, json: async () => ({ url: 'https://checkout.stripe.com/c/pay/cs_test_123' }) };
      }
      return { ok: true, json: async () => ({ plans: [], active: false }) };
    }
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(checkoutCalls.length, 1);
  assert.equal(historyCalls[0][2], '/#pricing');
  assert.equal(window.location.href, 'https://checkout.stripe.com/c/pay/cs_test_123');
});

test('receipt modal previews images/PDFs, handles errors and restores focus', () => {
  const { document } = dom();
  document.body.style.overflow = 'auto';
  vm.runInNewContext(read('receipt-preview.js'), { document, URL, window: { location: { origin: 'https://app.example' } } });
  const modal = document.getElementById('receipt-preview-modal');
  const content = document.getElementById('receipt-preview-content');
  const status = document.getElementById('receipt-preview-status');
  const link = document.createElement('a');
  const click = url => {
    link.href = url;
    document.listeners.click({ target: { closest: () => link }, preventDefault() {}, stopPropagation() {} });
  };
  click('https://cdn.example/receipt.png?version=1');
  assert.ok(modal.classList.contains('active'));
  assert.equal(content.children[0].tag, 'img');
  content.children[0].onerror();
  assert.match(status.textContent, /Não foi possível/);
  document.getElementById('close-receipt-preview').listeners.click();
  assert.equal(document.body.style.overflow, 'auto');
  assert.equal(document.activeElement, link);
  assert.equal(content.children.length, 0);
  click('https://cdn.example/receipt.PDF');
  assert.equal(content.children[0].type, 'application/pdf');
  document.listeners.keydown({ key: 'Escape', preventDefault() {}, stopImmediatePropagation() {} });
  assert.equal(modal.classList.contains('active'), false);
  click('javascript:alert(1)');
  assert.equal(modal.classList.contains('active'), false);
  click('https://cdn.example/receipt.unknown');
  assert.match(status.textContent, /não tem pré-visualização/);
  modal.listeners.click({ target: modal });
  assert.equal(modal.classList.contains('active'), false);
});