// A-22 연출 슬롯(2026-10-15): 창마다 배경 그림 자리를 두고 사용자가 직접 고른다. 키는 scene:<자리 이름>.
// 그림은 기존 그림 기능(pickImage·dropImage·clearImage)으로 앱 그림 폴더에 복사된다. 코드 없음, 그림만.
// 쓰는 법: SceneSlots.mount({ button: 버튼을 넣을 요소, slots: [{ key: 'scene:govoffice', label: '집무실', hint, spec: '1600×1200 · 4:3', drop: 끌어놓을 요소, apply(url) }] })
// 규격 견본 그림은 앱 폴더 example/backgrounds (README_KO.md). 팝업의 "규격 견본 보기"가 그 폴더를 연다.
(function () {
  const CSS = `.ssl-btn{-webkit-app-region:no-drag;background:none;border:1px solid var(--line,#5fd4e455);color:var(--dim,#8aa);font:inherit;font-size:12px;padding:2px 10px;cursor:pointer}
.ssl-btn:hover{color:var(--text,#fff);border-color:var(--hi,#5fd4e4)}
.ssl-pop{position:fixed;z-index:80;min-width:260px;max-width:340px;padding:10px 12px;background:var(--panel,#0b1a22);color:var(--text,#dcecf0);border:1px solid var(--hi,#5fd4e4);box-shadow:0 8px 30px #000a;font-size:12.5px;-webkit-app-region:no-drag}
.ssl-pop h4{margin:0 0 8px;font-size:12px;letter-spacing:.14em;color:var(--dim,#8aa);font-weight:normal}
.ssl-row{display:grid;grid-template-columns:52px 1fr;gap:4px 10px;align-items:center;padding:6px 0;border-top:1px dotted var(--line2,#5fd4e422)}
.ssl-th{width:52px;height:34px;border:1px solid var(--line,#5fd4e455);background:#0006 center/cover no-repeat;grid-row:span 2}
.ssl-row b{font-weight:normal} .ssl-row .h{grid-column:2;color:var(--dim,#8aa);font-size:11px}
.ssl-row .b{grid-column:2;display:flex;gap:6px} .ssl-row .b button{font:inherit;font-size:11.5px;padding:2px 8px;background:none;border:1px solid var(--line,#5fd4e455);color:var(--text,#dcecf0);cursor:pointer}
.ssl-row .b button:disabled{opacity:.4;cursor:default} .ssl-row .sp{grid-column:2;color:var(--gold,#e8c872);font-size:11px;font-family:var(--mono,Consolas,monospace)}
.ssl-foot{display:flex;align-items:center;gap:8px;margin-top:8px} .ssl-foot button{font:inherit;font-size:11.5px;padding:2px 10px;background:none;border:1px solid var(--hi,#5fd4e4);color:var(--hi,#5fd4e4);cursor:pointer} .ssl-note{margin-top:6px;color:var(--dim,#8aa);font-size:11px} .ssl-note.err{color:var(--bad,#e0705f)}
.ssl-drop{outline:2px dashed var(--hi,#5fd4e4);outline-offset:-6px}`;
  function mount(o) {
    if (!o || !Array.isArray(o.slots) || !window.sllm || !window.sllm.getImageState) return null;
    if (!document.getElementById('ssl-css')) { const s = document.createElement('style'); s.id = 'ssl-css'; s.textContent = CSS; document.head.appendChild(s); }
    let st = null, pop = null, note = '';
    const url = (k) => (st && st.images && st.images[k]) || null;
    const apply = () => o.slots.forEach((sl) => { try { sl.apply(url(sl.key)); } catch (e) { /* 창 쪽 실수는 무시 */ } });
    const set = (s) => { if (s) { st = s; note = s.note || ''; } apply(); if (pop) draw(); };
    const target = (key) => ({ kind: 'portrait', key, label: (o.slots.find((x) => x.key === key) || {}).label || '' });
    function draw() {
      pop.innerHTML = '<h4>' + (o.title || '배경 그림') + '</h4>' + o.slots.map((sl, i) => {
        const u = url(sl.key);
        return `<div class="ssl-row"><div class="ssl-th" data-i="${i}"></div><b>${sl.label}</b><div class="b"><button data-p="${i}">그림 고르기</button><button data-c="${i}" ${u ? '' : 'disabled'}>기본으로</button></div>${sl.hint ? `<div class="h">${sl.hint}</div>` : ''}${sl.spec ? `<div class="sp">권장 ${sl.spec}</div>` : ''}</div>`;
      }).join('') + `<div class="ssl-note${note ? ' err' : ''}">${note || 'png·jpg·webp·gif, 8MB까지. 창을 가득 채우고 가운데 기준으로 잘립니다. 그림 파일을 화면 위로 끌어 놓아도 됩니다.'}</div>`
        + (window.sllm.openSceneExamples ? '<div class="ssl-foot"><button data-ex="1" title="자리마다 크기·가려지는 곳을 표시한 견본 그림과 설명이 있는 폴더(example)를 엽니다">규격 견본 보기</button></div>' : '');
      pop.querySelectorAll('.ssl-th').forEach((d) => { const u = url(o.slots[+d.dataset.i].key); if (u) d.style.backgroundImage = `url("${u}")`; });
      pop.querySelectorAll('[data-p]').forEach((b) => { b.onclick = () => window.sllm.pickImage(target(o.slots[+b.dataset.p].key)).then(set); });
      const ex = pop.querySelector('[data-ex]'); if (ex) ex.onclick = () => window.sllm.openSceneExamples().then((m) => { if (m) { note = m; draw(); } });
      pop.querySelectorAll('[data-c]').forEach((b) => { b.onclick = () => window.sllm.clearImage(target(o.slots[+b.dataset.c].key)).then(set); });
    }
    function toggle(e) {
      if (pop) { pop.remove(); pop = null; return; }
      pop = document.createElement('div'); pop.className = 'ssl-pop'; pop.setAttribute('role', 'dialog'); document.body.appendChild(pop); note = ''; draw();
      const r = btn.getBoundingClientRect(); pop.style.top = Math.round(r.bottom + 6) + 'px'; pop.style.left = Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, Math.round(r.right - pop.offsetWidth))) + 'px';
      e && e.stopPropagation();
    }
    const btn = document.createElement('button'); btn.className = 'ssl-btn'; btn.type = 'button'; btn.textContent = o.buttonText || '배경 설정'; btn.title = '이 창의 배경 그림을 직접 고릅니다'; btn.onclick = toggle;
    if (o.button) o.button.appendChild(btn);
    document.addEventListener('click', (e) => { if (pop && !pop.contains(e.target) && e.target !== btn) { pop.remove(); pop = null; } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && pop) { pop.remove(); pop = null; e.stopImmediatePropagation(); } }, true);
    o.slots.forEach((sl) => {
      const el = sl.drop; if (!el || !window.sllm.dropImage) return;
      el.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); el.classList.add('ssl-drop'); } });
      el.addEventListener('dragleave', () => el.classList.remove('ssl-drop'));
      el.addEventListener('drop', (e) => { e.preventDefault(); e.stopPropagation(); el.classList.remove('ssl-drop'); const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) window.sllm.dropImage(target(sl.key), f).then(set); });
    });
    window.sllm.getImageState().then(set, () => apply());
    if (window.sllm.onImages) window.sllm.onImages((s) => set(s));
    return { refresh: () => window.sllm.getImageState().then(set), toggle };
  }
  window.SceneSlots = { mount };
})();
