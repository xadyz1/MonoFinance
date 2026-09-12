(function () {
  const modal = document.getElementById('receipt-preview-modal');
  if (!modal) return;
  const content = document.getElementById('receipt-preview-content');
  const status = document.getElementById('receipt-preview-status');
  const external = document.getElementById('receipt-preview-external');
  const closeButton = document.getElementById('close-receipt-preview');
  let previousFocus = null;
  let previousOverflow = '';

  function closePreview() {
    if (!modal.classList.contains('active')) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    content.replaceChildren();
    external.removeAttribute('href');
    document.body.style.overflow = previousOverflow;
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
  }

  function openPreview(link) {
    let url;
    try {
      url = new URL(link.href, window.location.origin);
      if (!['https:', 'http:'].includes(url.protocol)) return;
    } catch { return; }
    if (!modal.classList.contains('active')) {
      previousFocus = link;
      previousOverflow = document.body.style.overflow;
    }
    content.replaceChildren();
    external.href = url.href;
    const isPdf = /\.pdf$/i.test(url.pathname);
    const isImage = /\.(png|jpe?g|gif|webp|avif|bmp|svg|heic|heif)$/i.test(url.pathname);
    if (isPdf) {
      const preview = document.createElement('object');
      preview.type = 'application/pdf';
      preview.data = url.href;
      preview.className = 'receipt-preview-pdf';
      preview.setAttribute('aria-label', 'Pré-visualização do recibo PDF');
      preview.textContent = 'O navegador não permite apresentar este PDF. Utilize a ligação abaixo.';
      content.appendChild(preview);
      status.textContent = 'Se o PDF não aparecer, abra o ficheiro noutra janela.';
    } else if (isImage) {
      const preview = document.createElement('img');
      preview.alt = 'Anexo da transação';
      preview.className = 'receipt-preview-image';
      status.textContent = 'A carregar anexo…';
      preview.onload = () => { if (preview.isConnected) status.textContent = ''; };
      preview.onerror = () => {
        if (preview.isConnected) status.textContent = 'Não foi possível apresentar a imagem. Abra o ficheiro noutra janela.';
      };
      preview.src = url.href;
      content.appendChild(preview);
    } else {
      status.textContent = 'Este formato não tem pré-visualização. Abra o ficheiro através da ligação abaixo.';
    }
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    closeButton.focus();
  }

  // Delegation also covers transaction lists rendered after loading/filtering.
  document.addEventListener('click', event => {
    const link = event.target.closest('a[data-receipt-preview]');
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    event.stopPropagation();
    openPreview(link);
  });
  closeButton.addEventListener('click', closePreview);
  modal.addEventListener('click', event => { if (event.target === modal) closePreview(); });
  document.addEventListener('keydown', event => {
    if (!modal.classList.contains('active')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      closePreview();
    } else if (event.key === 'Tab') {
      if (event.shiftKey && document.activeElement === closeButton) {
        event.preventDefault();
        external.focus();
      } else if (!event.shiftKey && document.activeElement === external) {
        event.preventDefault();
        closeButton.focus();
      }
    }
  }, true);
})();