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
        openSubscribeModal(priceId);
      });
    });
  }

  let selectedPriceId = null;
  function openSubscribeModal(priceId) {
    selectedPriceId = priceId;
    const modal = document.getElementById('subscribeModal');
    const error = document.getElementById('subscribe-error');
    const nameInput = document.getElementById('subscribe-name');
    const emailInput = document.getElementById('subscribe-email');
    if (error) error.textContent = '';
    if (nameInput) nameInput.value = '';
    if (emailInput) emailInput.value = '';
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeSubscribeModal() {
    const modal = document.getElementById('subscribeModal');
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }

  async function startCheckoutFromModal() {
    if (!selectedPriceId) return;
    const nameInput = document.getElementById('subscribe-name');
    const emailInput = document.getElementById('subscribe-email');
    const error = document.getElementById('subscribe-error');
    const name = (nameInput?.value || '').trim();
    const email = (emailInput?.value || '').trim().toLowerCase();

    if (!name || name.length < 2) {
      if (error) error.textContent = 'Por favor, introduza o seu nome.';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (error) error.textContent = 'Por favor, introduza um email válido.';
      return;
    }
    if (error) error.textContent = '';

    const payBtn = document.getElementById('subscribe-pay-btn');
    if (payBtn) { payBtn.disabled = true; payBtn.textContent = 'A processar…'; }

    try {
      const res = await fetch(`${API_URL}/api/create-checkout-session`, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: selectedPriceId, name, email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Não foi possível iniciar o pagamento.');
      if (!data.clientSecret) throw new Error('O servidor não devolveu uma sessão de pagamento válida.');
      closeSubscribeModal();
      await openEmbeddedCheckout(data.clientSecret);
    } catch (err) {
      if (error) error.textContent = err.message || 'Erro ao iniciar pagamento.';
      if (payBtn) { payBtn.disabled = false; payBtn.textContent = 'Proceder ao pagamento'; }
    }
  }

  async function openEmbeddedCheckout(clientSecret) {
    const container = document.getElementById('stripe-container');
    const stripeKey = window.STRIPE_PUBLISHABLE_KEY || 'pk_live_...';
    const stripe = window.Stripe ? window.Stripe(stripeKey) : null;
    if (!stripe) {
      container.innerHTML = '<p style="text-align:center;color:var(--muted);padding:16px">Stripe não está disponível. Recarregue a página.</p>';
      openStripeModal();
      return;
    }
    container.innerHTML = '<div id="embedded-checkout" style="flex:1"></div>';
    openStripeModal();
    const checkout = await stripe.initEmbeddedCheckout({ clientSecret });
    checkout.mount('#embedded-checkout');
  }

  let checkoutPending = false;
  async function resumeCheckout(priceId) {
    if (checkoutPending) return;
    const container = document.getElementById('stripe-container');
    openStripeModal();
    container.innerHTML = '<p style="text-align:center;color:var(--muted);padding:16px">A preparar o pagamento seguro…</p>';
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
      if (!data.clientSecret) throw new Error('O servidor não devolveu uma sessão de pagamento válida.');
      await openEmbeddedCheckout(data.clientSecret);
    } catch (error) {
      container.innerHTML = '<p style="text-align:center;color:var(--muted);padding:16px">' + (error.message || 'Não foi possível ligar ao serviço de pagamentos.') + '</p>';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'btn primary';
      retry.textContent = 'Tentar novamente';
      retry.addEventListener('click', () => resumeCheckout(priceId));
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

  const subscribeModal = document.getElementById('subscribeModal');
  if (subscribeModal) {
    document.getElementById('closeSubscribeModal').addEventListener('click', closeSubscribeModal);
    subscribeModal.addEventListener('click', e => { if (e.target === subscribeModal) closeSubscribeModal(); });
    document.getElementById('subscribe-pay-btn').addEventListener('click', startCheckoutFromModal);
    document.getElementById('subscribe-form').addEventListener('submit', e => { e.preventDefault(); startCheckoutFromModal(); });
  }

  const stripeModal = document.getElementById('stripeModal');
  function openStripeModal() { stripeModal.classList.add('open'); document.body.style.overflow = 'hidden'; }
  function closeStripeModal() { stripeModal.classList.remove('open'); document.body.style.overflow = ''; }
  document.getElementById('closeStripeModal').addEventListener('click', closeStripeModal);
  stripeModal.addEventListener('click', e => { if (e.target === stripeModal) closeStripeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeStripeModal(); closeSubscribeModal(); } });

  fetchPlans();
  fetchAds();
  const params = new URLSearchParams(window.location.search);
  const checkoutPrice = params.get('checkout');
  if (checkoutPrice) {
    params.delete('checkout');
    const query = params.toString();
    window.history.replaceState(null, '', window.location.pathname + (query ? '?' + query : '') + '#pricing');
    resumeCheckout(checkoutPrice);
  }
})();
