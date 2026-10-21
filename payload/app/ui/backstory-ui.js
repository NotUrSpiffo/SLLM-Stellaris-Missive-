// 배경 이야기(전기) 입력 창(2026-10-18). 외교 단말기(index.html)의 「제국 전기」, 집무실(office.html)의 「인물 전기」가 같이 쓴다.
// 문구는 한국어 원문 + i18n-catalog 영어(언어 팩 호환). 이름 칸은 번역하지 않는다(data-i18n-skip).
(function () {
  const T = (t) => (window.SLLMI18n ? window.SLLMI18n.t(t) : t);
  const css = '.bs-ov{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;z-index:9999}'
    + '.bs-box{width:min(560px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;background:var(--bg,#0d1117);color:var(--fg,#ddd);border:1px solid var(--line,#444);padding:14px;box-sizing:border-box;font:inherit}'
    + '.bs-box h3{margin:0 0 4px;font-size:15px;color:var(--gold,#e0b85c)}.bs-box .bs-sub{font-size:12px;opacity:.8;margin:0 0 8px;line-height:1.5}'
    + '.bs-box textarea{width:100%;box-sizing:border-box;min-height:200px;resize:vertical;background:rgba(0,0,0,.35);color:inherit;border:1px solid var(--line,#444);padding:8px;font:inherit;line-height:1.5}'
    + '.bs-row{display:flex;gap:6px;align-items:center;margin-top:8px;flex-wrap:wrap}.bs-row .bs-sp{flex:1}.bs-cnt,.bs-msg{font-size:12px;opacity:.75}.bs-box button{cursor:pointer}';
  function ensureCss() { if (document.getElementById('bs-css')) return; const s = document.createElement('style'); s.id = 'bs-css'; s.textContent = css; document.head.append(s); }
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  /** o: { title, name, intro, load: () => Promise<{custom, auto?, max}>, save: (text) => Promise<{ok, error?}> } */
  async function open(o) {
    ensureCss();
    const ov = el('div', 'bs-ov'), box = el('div', 'bs-box'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    const h = el('h3'); h.append(document.createTextNode(T(o.title) + ' — ')); const nm = el('span', '', o.name || ''); nm.setAttribute('data-i18n-skip', ''); h.append(nm);
    const sub = el('p', 'bs-sub', T(o.intro));
    const ta = el('textarea'); ta.setAttribute('data-i18n-skip', ''); ta.disabled = true; ta.placeholder = T('불러오는 중…');
    const row = el('div', 'bs-row'), cnt = el('span', 'bs-cnt'), msg = el('span', 'bs-msg'), sp = el('span', 'bs-sp');
    const bAuto = el('button', '', T('게임 전기 불러오기')), bClear = el('button', '', T('지우기')), bCancel = el('button', '', T('닫기')), bSave = el('button', 'primary', T('저장'));
    row.append(cnt, msg, sp, bAuto, bClear, bCancel, bSave);
    box.append(h, sub, ta, row); ov.append(box); document.body.append(ov);
    let max = 2000, auto = '';
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
    const count = () => { cnt.textContent = ta.value.length + ' / ' + max; };
    ta.addEventListener('input', count);
    bCancel.onclick = close;
    bClear.onclick = () => { ta.value = ''; count(); ta.focus(); };
    bAuto.onclick = () => { if (auto) { ta.value = auto; count(); } };
    bSave.onclick = async () => {
      bSave.disabled = true; msg.textContent = T('저장하는 중…');
      try { const r = await o.save(ta.value.slice(0, max)); if (r && r.ok) { close(); if (o.onSaved) o.onSaved(r.custom || ''); } else msg.textContent = (r && r.error) || T('저장하지 못했습니다.'); }
      catch (e) { msg.textContent = T('저장하지 못했습니다.'); }
      finally { bSave.disabled = false; }
    };
    try {
      const v = await o.load();
      if (!v) { msg.textContent = T('지금은 열 수 없습니다. 세이브를 불러온 뒤 다시 시도하세요.'); ta.placeholder = ''; bSave.disabled = true; return; }
      max = v.max || max; auto = v.auto || ''; ta.maxLength = max;
      ta.value = v.custom || ''; ta.placeholder = T(o.placeholder || '이 인물의 출신, 겪은 일, 성격, 말버릇 등을 자유롭게 적어 주세요.');
      bAuto.hidden = !auto; if (!v.custom && auto) msg.textContent = T('지금은 게임 전기를 씁니다. 고쳐 쓰려면 「게임 전기 불러오기」를 누르세요.');
    } catch (e) { msg.textContent = T('불러오지 못했습니다.'); }
    ta.disabled = false; count(); ta.focus();
  }
  window.SLLMBackstory = { open };
})();
