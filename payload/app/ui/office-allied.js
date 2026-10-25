// 집무실 「국정」의 동맹 평의회 타일. 통신 단말기 제목줄 단추와 같이 allyOpen 으로 연다.
// 언어 팩 규칙: 문구는 L('한국어', 'English') 만.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const TIP = ['방어 협정 상대와 종속국을 불러 회의를 엽니다.', 'Summon defensive-pact partners and subjects.'];
  function paint(btn) {
    const span = btn.querySelector('span');
    if (span) span.textContent = L('동맹 평의회', 'Allied council');
    const tip = L(TIP[0], TIP[1]);
    btn.title = tip;
    btn.setAttribute('aria-label', tip);
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('allyCall')) return;
    const anchor = document.querySelector('#icons button.ic[data-app="policy"]') || document.getElementById('secCall');
    const row = anchor && anchor.parentElement;
    if (!row) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ic';
    b.id = 'allyCall';
    b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="13" r="4"/><circle cx="10" cy="18" r="3.2"/><circle cx="38" cy="18" r="3.2"/><path d="M16 34c1.2-4.2 4-6.4 8-6.4s6.8 2.2 8 6.4"/><path d="M4 36c.9-3.2 2.8-5 6-5s5.1 1.8 6 5"/><path d="M32 36c.9-3.2 2.8-5 6-5s5.1 1.8 6 5"/><path d="M8 42h32"/></svg>';
    b.append(document.createElement('span'));
    paint(b);
    b.onclick = async () => {
      b.disabled = true;
      try {
        const r = await window.sllm.allyOpen();
        if (!r || !r.ok) alert((r && r.error) || L('평의회를 열지 못했습니다.', 'Could not open the council.'));
      } catch (e) { alert(e.message); }
      finally { b.disabled = false; }
    };
    anchor.after(b);
    document.addEventListener('sllm-language', () => { const btn = document.getElementById('allyCall'); if (btn) paint(btn); });
  });
})();
