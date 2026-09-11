(function () {
  const API_URL = window.location.origin;

  async function fetchDashboardAd() {
    try {
      const res = await fetch(`${API_URL}/api/ads?slot=dashboard`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.active && data.html) {
        const slot = document.getElementById('dashboard-ad-slot');
        if (slot) slot.innerHTML = data.html;
      }
    } catch (e) { console.error('dashboard ad', e); }
  }

  fetchDashboardAd();
})();
