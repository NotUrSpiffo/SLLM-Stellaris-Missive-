// Visual background only: use the existing empire-ethics resolver, never change meeting state.
(() => {
  const keys = new Set(['standard','authoritarian','egalitarian','xenophile','xenophobe','militarist','pacifist','spiritualist','materialist']);
  let seq = 0, current = '';
  async function refresh() {
    const n = ++seq;
    try {
      const state = await window.sllm.officeStyle();
      const key = keys.has(state?.auto) ? state.auto : 'standard';
      if (n !== seq || key === current) return;
      const img = new Image();
      img.onload = () => { if (n !== seq) return; const bg = document.getElementById('bg'); if (!bg) return; bg.classList.add('img'); bg.style.backgroundImage = `url("${img.src}")`; document.body.dataset.cabinetStyle = key; document.body.dataset.cabinetWidth = img.naturalWidth; document.body.dataset.cabinetHeight = img.naturalHeight; current = key; window.dispatchEvent(new Event("resize")); };
      img.src = key === 'standard' ? 'assets/rooms/cabinet-room-v1.png' : `assets/rooms/cabinet-room-${key}.png`;
    } catch (_) { /* Keep the built-in standard background if ethics are unavailable. */ }
  }
  window.addEventListener('load', refresh);
  window.addEventListener('focus', refresh);
  setInterval(() => { if (!document.hidden) refresh(); }, 15000);
})();
