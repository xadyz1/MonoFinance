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
        if (!priceId) return;
        const container = document.getElementById('stripe-container');
        container.innerHTML = `<stripe-buy-button buy-button-id="buy_btn_swiftfinance_${Date.now()}" publishable-key="pk_live_REPLACE_WITH_YOUR_KEY" price-id="${priceId}" customer-session-client-secret=""></stripe-buy-button>`;
        openStripeModal();
      });
    });
  }

  async function fetchAds() {
    try {
      const res = await fetch(`${API_URL}/api/ads?slot=landing`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.active && data.html) {
        const slot = document.getElementById('landing-ad-slot');
        if (slot) slot.innerHTML = data.html;
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

  fetchPlans();
  fetchAds();
})();
