// 집무실 「내각 회의」 소집(2026-10-19 사용자 결정). 앱: src/features/faction-app.ts(cabinetReady·facOpen), 회의실 화면: ui/cabinet-room.html.
// 평의회 의제 칸이 비면(회의를 열 수 있으면) ① 집무실에 알람 「내각 회의가 준비되었습니다. 가시겠습니까?」 ② 책상 위 홀로그램 태블릿.
// 태블릿 그림은 초안(CSS). 그림이 준비되면 ui/assets/office/desk-cabinet-tablet.png 를 두면 그것을 쓴다(GPT 담당).
// office.html 은 이 파일·css 만 더한다(집무실 다른 작업과 파일 충돌을 줄이려고). 문구는 L(한, 영)만(언어 팩 호환).
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  let cur = null, dismissed = '', busy = false;
  const SEEN = 'sllm.cabinet.alarmSeen';
  const seen = () => { try { return localStorage.getItem(SEEN) || ''; } catch (e) { return ''; } };
  const markSeen = (k) => { try { localStorage.setItem(SEEN, k); } catch (e) { /* 무시 */ } };

  function tablet() {
    let b = $('deskCabinet'); if (b) return b;
    b = h('button'); b.id = 'deskCabinet'; b.type = 'button'; b.hidden = true;
    const slab = h('span', 'slab'), glow = h('span', 'glow'), holo = h('span', 'holo'), img = new Image();
    img.className = 'art'; img.alt = ''; img.onload = () => b.classList.add('has-art'); img.onerror = () => img.remove();
    img.src = 'assets/office/desk-cabinet-tablet.png';
    holo.append(h('i'), h('i'), h('i'));
    b.append(img, slab, glow, holo, h('b', 'badge'));
    b.onclick = () => go();
    (document.body).append(b);
    return b;
  }
  function closeAlarm() { $('cabAlarm')?.remove(); }
  function alarm(c) {
    closeAlarm();
    const el = h('div', 'cab-alarm'); el.id = 'cabAlarm'; el.setAttribute('role', 'alertdialog'); el.setAttribute('aria-modal', 'false');
    const card = h('div', 'card');
    card.append(h('div', 'kicker', L('집무실 알림', 'Office notice')), h('h4', '', L('내각 회의가 준비되었습니다.', 'The cabinet meeting is ready.')),
      h('p', '', L(`장관 ${c.n}명이 회의실에 모였습니다. 가시겠습니까?`, `${c.n} minister(s) have gathered in the council chamber. Will you go?`)));
    const row = h('div', 'row'), goB = h('button', 'go', L('회의실로 가기', 'Go to the chamber')), later = h('button', 'later', L('나중에', 'Later'));
    goB.type = later.type = 'button';
    goB.onclick = () => go(); later.onclick = () => { dismissed = c.key; markSeen(c.key); closeAlarm(); };
    row.append(goB, later); card.append(row, h('small', '', L('책상 위 태블릿을 눌러도 회의실로 갈 수 있습니다.', 'You can also tap the tablet on the desk.')));
    el.append(card); document.body.append(el); goB.focus();
  }
  async function go() {
    if (busy) return; busy = true; closeAlarm();
    try {
      const r = await window.sllm.facOpen();
      if (r && !r.ok && r.error) { const t = $('cabTabletMsg') || h('div', 'cab-msg'); t.id = 'cabTabletMsg'; t.textContent = r.error; document.body.append(t); setTimeout(() => t.remove(), 4000); }
      else if (cur) markSeen(cur.key);
    } catch (e) { /* 무시 */ }
    busy = false;
  }
  function update(s) {
    const c = s && s.cabinet ? s.cabinet : null; cur = c;
    const b = tablet(); b.hidden = !c || document.body.classList.contains('boot');
    const label = L('내각 회의 — 회의실로 가기', 'Cabinet meeting — go to the chamber'); b.title = label; b.setAttribute('aria-label', label);
    b.querySelector('.badge').textContent = c ? L('소집', 'Convened') : '';
    if (!c) { closeAlarm(); return; }
    // 같은 소집은 한 번만 알린다(나중에를 눌렀거나 이미 들어갔으면 태블릿만).
    if (c.key !== dismissed && c.key !== seen() && !$('cabAlarm') && !document.body.classList.contains('docked')) alarm(c);
  }
  document.addEventListener('DOMContentLoaded', () => {
    if (window.sllm.onOfficeState) window.sllm.onOfficeState(update);
    window.sllm.officeState().then(update).catch(() => {});
    document.addEventListener('sllm-language', () => { if (cur) { update({ cabinet: cur }); if ($('cabAlarm')) alarm(cur); } });
  });
  window.SLLMCabinetDesk = { go };
})();
