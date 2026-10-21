// 집무실 「민심」 칩(2026-10-20 알파 10): 머리말의 평시/전시 표시 옆에 민심 점수·단계·추이를 보이고, 누르면 구성 요소와 최근 2년 그래프를 펼친다.
// 앱: src/features/mood-app.ts, 규칙: src/mood.ts. office.html 은 이 파일·css 만 더한다(집무실 다른 작업과 충돌을 줄이려고).
// 언어 팩 규칙: 문구는 L('한국어', 'English')(SLLMI18n.pick)으로만.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  let V = null, open = false;
  const LV = { jubilant: ['열광', 'Jubilant'], content: ['만족', 'Content'], steady: ['보통', 'Steady'], discontent: ['불만', 'Discontent'], unrest: ['분노', 'Unrest'] };
  const lvName = (l) => (LV[l] ? L(LV[l][0], LV[l][1]) : '');
  function spark(series) {
    const W = 260, H = 56, pts = series.map((p) => p.score); if (pts.length < 2) return null;
    const lo = Math.max(0, Math.min(...pts) - 8), hi = Math.min(100, Math.max(...pts) + 8), Y = (v) => H - ((v - lo) / Math.max(1, hi - lo)) * H; // 변화가 보이게 위아래를 맞춤
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'md-spark');
    for (const y of [30, 45, 60, 75]) { if (y <= lo || y >= hi) continue; const ln = document.createElementNS(ns, 'line'); const yy = Y(y); ln.setAttribute('x1', '0'); ln.setAttribute('x2', String(W)); ln.setAttribute('y1', String(yy)); ln.setAttribute('y2', String(yy)); ln.setAttribute('class', 'md-grid'); svg.append(ln); }
    const d = pts.map((v, i) => `${i ? 'L' : 'M'}${(i / (pts.length - 1)) * W},${Y(v)}`).join(' ');
    const path = document.createElementNS(ns, 'path'); path.setAttribute('d', d); path.setAttribute('class', 'md-line'); svg.append(path);
    return svg;
  }
  function draw() {
    let chip = $('moodChip');
    const host = $('state'); if (!host) return;
    if (!chip) { chip = h('button', 'md-chip'); chip.type = 'button'; chip.id = 'moodChip'; chip.onclick = (e) => { e.stopPropagation(); open = !open; draw(); }; host.after(chip); }
    chip.textContent = ''; chip.className = 'md-chip' + (V && V.level ? ' md-' + V.level : ' md-none');
    if (!V || V.score === null || V.score === undefined) { chip.append(h('span', '', L('민심 —', 'Mood —'))); chip.title = L('민심: 게임에서 다음 달 상황을 받으면 표시됩니다.', 'Public mood: shown once the next monthly report arrives from the game.'); }
    else {
      const arrow = V.trend >= 5 ? ' ▲' : V.trend <= -5 ? ' ▼' : '';
      chip.append(h('span', 'md-k', L('민심', 'Mood')), h('b', '', String(V.score)), h('span', 'md-l', lvName(V.level) + arrow));
      chip.title = L('민심(시민 지지도) — 눌러서 자세히', 'Public mood — click for details');
    }
    let pop = $('moodPop');
    if (!open || !V || V.score === null) { if (pop) pop.remove(); return; }
    if (!pop) { pop = h('div', 'md-pop'); pop.id = 'moodPop'; pop.onclick = (e) => e.stopPropagation(); document.body.append(pop); }
    pop.textContent = '';
    const r = chip.getBoundingClientRect(); pop.style.top = (r.bottom + 6) + 'px'; pop.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
    pop.append(h('div', 'md-h', L('민심 — 시민 지지도', 'Public mood')));
    const big = h('div', 'md-big'); big.append(h('b', '', String(V.score)), h('span', 'md-' + V.level, lvName(V.level)), h('small', '', (V.trend > 0 ? '+' : '') + V.trend + L(' (반년 전보다)', ' (vs. half a year ago)'))); pop.append(big);
    const sv = spark(V.series || []); if (sv) pop.append(sv);
    const P = V.parts || {}, ul = h('ul', 'md-parts');
    if (P.stability !== null && P.stability !== undefined) ul.append(h('li', '', L('행성 안정도 평균 ', 'Average planetary stability ') + P.stability));
    if (P.approval !== null && P.approval !== undefined) ul.append(h('li', '', L('파벌 승인도(지지율 가중) ', 'Faction approval (weighted by support) ') + P.approval));
    if (P.warPenalty) ul.append(h('li', 'neg', L('전쟁 피로 −', 'War weariness −') + P.warPenalty));
    if (P.unrestPenalty) ul.append(h('li', 'neg', L('불안한 행성 −', 'Restless worlds −') + P.unrestPenalty));
    if (P.eventAdj) ul.append(h('li', P.eventAdj < 0 ? 'neg' : 'pos', L('최근 사건 ', 'Recent events ') + (P.eventAdj > 0 ? '+' : '') + P.eventAdj));
    pop.append(ul);
    for (const a of V.adj || []) pop.append(h('div', 'md-adj', a.date + ' · ' + (a.value > 0 ? '+' : '') + a.value + ' · ' + a.why));
    pop.append(h('p', 'md-note', L('민심은 읽기 전용입니다. 신문과 라디오의 논조에 반영되고, 크게 떨어지면 알려 드립니다.', 'Public mood is read-only. It colors the tone of the newspaper and radio, and you are alerted when it drops sharply.')));
  }
  async function load() { try { V = await window.sllm.moodState(); } catch (e) { V = null; } draw(); }
  document.addEventListener('DOMContentLoaded', () => {
    load();
    if (window.sllm.onMoodUpdate) window.sllm.onMoodUpdate((v) => { V = v; draw(); });
    document.addEventListener('click', () => { if (open) { open = false; draw(); } });
    document.addEventListener('sllm-language', draw);
  });
  window.SLLMMood = { load };
})();
