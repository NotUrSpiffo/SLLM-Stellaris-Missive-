// 대보관소 수집품 보기(알파 6 1단계): 만찬 창의 🏛 버튼 → 보유 표본 목록(분류·희귀도)과 분류별 전시 수. 게임에서 다시 읽기 가능.
// 2단계(선물): 표본마다 [선물] → 만찬 대화의 표본 선물 카드. 3단계(역요구)도 이 목록을 쓴다.
(() => {
 const get = (id) => document.getElementById(id);
 const CAT = { xeno_geology: '외계 지질학', aesthetic_wonder: '미적 경이', historical_item: '은하 역사' };
 const RAR = { exceptional: '탁월', epic: '에픽', rare: '희귀', common: '일반' };
 const en = () => !!(window.SLLMI18n && window.SLLMI18n.language && window.SLLMI18n.language() === 'en'); // i18n-data: 표본 이름은 한/영 자료 중 고름
 let snap = null, filter = '', busy = false;
 const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
 function draw() {
  const body = get('archiveBody'), head = get('archiveHead'); if (!body) return;
  body.replaceChildren(); head.replaceChildren();
  if (!snap) { body.append(el('p', 'muted', busy ? '게임에서 표본 목록을 읽는 중…' : '아직 읽지 않았습니다. [게임에서 다시 읽기]를 누르세요.')); return; }
  const n = el('b', '', String(snap.items.length)); head.append(el('span', '', '보유 표본'), n, el('span', 'dim', '· ' + (snap.date || '')));
  const ex = el('div', 'ex'); ex.append(el('span', 'dim', '전시 중'));
  for (const c of Object.keys(CAT)) { const s = el('span', 'exc'); s.append(el('span', '', CAT[c]), el('b', '', String(snap.exhibits[c] || 0))); ex.append(s); }
  head.append(ex);
  const chips = get('archiveCats'); chips.replaceChildren();
  for (const [v, t] of [['', '모든 분류'], ...Object.entries(CAT)]) { const b = el('button', 'chip' + (filter === v ? ' on' : ''), t); const cnt = v ? snap.items.filter((i) => i.cat === v).length : snap.items.length; b.append(el('small', '', ' ' + cnt)); b.onclick = () => { filter = v; draw(); }; chips.append(b); }
  const list = snap.items.filter((i) => !filter || i.cat === filter);
  if (!list.length) { body.append(el('p', 'muted', snap.items.length ? '이 분류의 표본이 없습니다.' : '보유한 표본이 없습니다.')); return; }
  for (const it of list) { const row = el('div', 'spec r-' + it.rarity); const nm = el('span', 'nm', en() ? it.en : it.ko); nm.setAttribute('data-i18n-skip', ''); row.append(el('span', 'rar', RAR[it.rarity]), nm, el('span', 'cat', CAT[it.cat])); row.title = it.key;
   if (window.sllm.banquetSpecSet) { const g = el('button', 'give', '선물'); g.title = '이 표본을 초청 지도자에게 선물합니다(확인 카드가 열림)'; g.onclick = async () => { get('archiveErr').textContent = ''; try { const r = await window.sllm.banquetSpecSet(it.key); if (r && r.ok) get('archivePanel').hidden = true; else get('archiveErr').textContent = (r && r.error) || '선물 카드를 열지 못했습니다.'; } catch (e) { get('archiveErr').textContent = String(e); } }; row.append(g); }
   body.append(row); }
  if (snap.unknown && snap.unknown.length) body.append(el('p', 'muted', (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(`목록에 없는 표본 ${snap.unknown.length}개(다른 모드 표본일 수 있음)`, `${snap.unknown.length} specimen(s) not in the list (possibly from other mods)`) : `목록에 없는 표본 ${snap.unknown.length}개(다른 모드 표본일 수 있음)`)));
 }
 async function scan() {
  if (busy) return; busy = true; get('archiveErr').textContent = ''; get('archiveScan').disabled = true; draw();
  try { const r = await window.sllm.archiveScan(); if (r && r.ok) snap = r.snapshot; else get('archiveErr').textContent = (r && r.error) || '읽지 못했습니다.'; }
  catch (e) { get('archiveErr').textContent = String(e); }
  finally { busy = false; get('archiveScan').disabled = false; draw(); }
 }
 function open() { get('archivePanel').hidden = false; if (!snap) window.sllm.archiveState().then((s) => { snap = s && s.snapshot; draw(); if (!snap) void scan(); }).catch(() => draw()); else draw(); }
 document.addEventListener('sllm-language', () => { if (get('archivePanel') && !get('archivePanel').hidden) draw(); });
 window.SLLMArchive = { refresh: () => window.sllm.archiveState().then((s) => { snap = (s && s.snapshot) || snap; draw(); }).catch(() => {}) };
 if (get('archiveOpen')) {
  get('archiveOpen').onclick = open; get('archiveClose').onclick = () => { get('archivePanel').hidden = true; }; get('archiveScan').onclick = scan;
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !get('archivePanel').hidden) get('archivePanel').hidden = true; });
 }
})();
