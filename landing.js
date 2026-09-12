(function () {
  const API_URL = window.location.origin;

  async function fetchPlans() {
    try {
      const res = await fetch(`${API_URL}/api/plans`);
      if (!res.ok) return;
      const data = await res.json();
      const plans = (Array.isArray(data) ? data : data.plans || []).filter(p => p.active !== false);
      const grid = document.getElementById('plans-grid');
      if (!grid || !plans.length) return;
      grid.innerHTML = plans.map(p => {
        const isFree = Number(p.price) === 0;
        const featured = p.popular ? 'featured' : '';
        const badge = p.popular ? `<div class="badge">Mais popular</div>` : '';
        const features = (Array.isArray(p.features) ? p.features : (p.features || '').split('\n')).filter(f => String(f).trim()).map(f => `<li>${escapeHtml(String(f))}</li>`).join('');
        const btnClass = isFree ? 'secondary' : 'primary';
        const btnText = isFree ? 'Começar grátis' : 'Subscrever';
        const period = isFree ? '/ para sempre' : '/ mês';
        return `<article class="price ${featured}">${badge}<h3>${escapeHtml(p.name)}</h3><p class="desc">${escapeHtml(p.description || '')}</p><div class="amount">${Number(p.price).toFixed(2)} € <small>${period}</small></div><ul>${features}</ul><button class="btn ${btnClass} js-subscribe" data-price-id="${escapeHtml(p.stripe_price_id || '')}" data-free="${isFree}">${btnText}</button></article>`;
      }).join('');
      bindSubscribeButtons();
    } catch (e) { console.error('plans', e); }
  }

  function bindSubscribeButtons() {
    document.querySelectorAll('.js-subscribe').forEach(btn => {
      btn.addEventListener('click', () => {
        const priceId = btn.dataset.priceId;
        const isFree = btn.dataset.free === 'true';
        if (isFree) { window.location.href = '/login'; return; }
        startCheckout(priceId);
      });
    });
  }

  let checkoutPending = false;
  async function startCheckout(priceId) {
    if (checkoutPending) return;
    const container = document.getElementById('stripe-container');
    openStripeModal();
    container.textContent = 'A preparar o pagamento seguro…';
    checkoutPending = true;
    try {
      if (!priceId) throw new Error('Este plano ainda não tem um preço Stripe configurado.');
      const res = await fetch(`${API_URL}/api/create-checkout-session`, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId })
      });
      if (res.status === 401) {
        window.location.href = '/login?checkout=' + encodeURIComponent(priceId);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Não foi possível iniciar o pagamento.');
      const checkoutUrl = new URL(data.url);
      if (checkoutUrl.protocol !== 'https:' || checkoutUrl.hostname !== 'checkout.stripe.com') {
        throw new Error('O servidor devolveu um endereço de pagamento inválido.');
      }
      window.location.href = checkoutUrl.href;
    } catch (error) {
      container.textContent = error.message || 'Não foi possível ligar ao serviço de pagamentos.';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'btn primary';
      retry.textContent = 'Tentar novamente';
      retry.addEventListener('click', () => startCheckout(priceId));
      container.appendChild(retry);
    } finally {
      checkoutPending = false;
    }
  }

  async function fetchAds() {
    try {
      const res = await fetch(`${API_URL}/api/ads?slot=landing`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.active && data.html) {
        const slot = document.getElementById('landing-ad-slot');
        const labelEl = document.querySelector('#landing-ad-section .ad-label span');
        if (slot) {
          slot.innerHTML = data.html;
          document.getElementById('landing-ad-section').hidden = false;
          if (labelEl) labelEl.textContent = current === 'en' ? 'Advertising' : 'Publicidade';
        }
      }
    } catch (e) { console.error('ads', e); }
  }

  function escapeHtml(str) {
    return (str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  const stripeModal = document.getElementById('stripeModal');
  function openStripeModal() { stripeModal.classList.add('open'); document.body.style.overflow = 'hidden'; }
  function closeStripeModal() { stripeModal.classList.remove('open'); document.body.style.overflow = ''; }
  document.getElementById('closeStripeModal').addEventListener('click', closeStripeModal);
  stripeModal.addEventListener('click', e => { if (e.target === stripeModal) closeStripeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeStripeModal(); });

  fetchPlans();
  fetchAds();
  const params = new URLSearchParams(window.location.search);
  const checkoutPrice = params.get('checkout');
  if (checkoutPrice) {
    params.delete('checkout');
    const query = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (query ? '?' + query : '') + '#pricing');
    startCheckout(checkoutPrice);
  }
})();
