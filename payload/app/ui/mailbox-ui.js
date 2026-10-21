(() => {
  const button = document.getElementById('btnInbox'), list = document.getElementById('mailList'), detail = document.getElementById('mailDetail'), dmail = document.getElementById('dmail');
  let letters = [], selected = null, replying = false, version = 0;
  const badge = document.getElementById('mailBadge'), led = document.getElementById('mailLed'), ledT = document.getElementById('mailLedT');
  const init = (n) => (String(n || '?').trim()[0] || '?').toUpperCase();
  function tag(text, cls) { const t = document.createElement('span'); t.className = 'mi-tag ' + cls; t.textContent = text; return t; }
  function draw() {
    const unread = letters.filter(l => !l.read).length;
    button.title = '외교 서신 수신함' + (unread ? ' · 안 읽음 ' + unread : '');
    badge.hidden = !unread; badge.textContent = unread > 99 ? '99+' : String(unread);
    { const ra = document.getElementById('mailReadAll'); if (ra) ra.disabled = !unread; }
    if (led) { led.className = 'tm-led ' + (unread ? 'busy' : letters.length ? 'on' : ''); const PK = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k); ledT.textContent = unread ? PK('새 편지 ', 'New letters ') + unread : letters.length ? PK(`편지 ${letters.length}통`, `${letters.length} letter(s)`) : PK('편지 없음', 'No letters'); }
    list.textContent = '';
    if (!letters.length) { const d = document.createElement('div'); d.className = 'tm-empty'; const b = document.createElement('b'); b.textContent = '받은 편지 없음'; d.append(b, '이 세이브에 받은 편지가 없습니다.'); list.appendChild(d); }
    for (const l of letters.slice().reverse()) {
      const b = document.createElement('button'); b.className = 'mail-item' + (l.read ? ' read' : '') + (l.id === selected ? ' sel' : '');
      const av = document.createElement('div'); av.className = 'tm-av' + (l.read ? '' : ' unread'); av.textContent = init(l.name);
      const m = document.createElement('div'); m.className = 'mi-main'; const nb = document.createElement('b'); nb.textContent = l.name; const sm = document.createElement('small'); sm.textContent = l.date; m.append(nb, sm);
      const tg = document.createElement('div'); tg.className = 'mi-tags';
      if (l.proposal && !l.proposalHandled) tg.appendChild(tag('제안 있음', 'hot')); else if (l.proposal) tg.appendChild(tag('응답함', 'done'));
      b.append(av, m, tg); b.onclick = () => read(l.id); list.appendChild(b);
    }
    if (selected && !letters.some(l => l.id === selected)) { selected = null; detail.textContent = ''; }
    if (dmail) dmail.classList.toggle('reading', !!selected); // 편지를 열면 낮은 창에서는 위쪽 머리·버튼·목록을 접고 본문에 자리를 준다(terminal-layout.css)
  }
  function update(items) { version++; letters = items; draw(); }
  async function read(id) {
    const at = version;
    try {
      const r = await window.sllm.openLetter(id);
      if (at !== version && !letters.some(l => l.id === id)) return;
      selected = id; detail.textContent = '';
      const h = document.createElement('div'); h.className = 'ml-head'; const av = document.createElement('div'); av.className = 'tm-av'; av.textContent = init(r.letter.name); const hw = document.createElement('div'); const h3 = document.createElement('h3'); h3.textContent = r.letter.name; const hs = document.createElement('small'); hs.textContent = r.letter.date; hw.append(h3, hs); h.append(av, hw);
      const body = document.createElement('div'); body.className = 'mail-body'; body.textContent = r.letter.text;
      const note = document.createElement('p'); note.className = 'ml-note'; note.textContent = r.expired ? '편지 속 제안은 만료되었습니다. 통신이 가능하면 답장은 보낼 수 있습니다.' : r.letter.proposalHandled ? '이미 응답한 제안입니다.' : '답장하기를 누르면 게임에서 최신 통신 상태를 확인합니다.';
      const reply = document.createElement('button'); reply.className = 'tm-call'; reply.textContent = '▶ 답장하기'; reply.disabled = replying;
      const status = document.createElement('span'); status.className = 'ml-note'; status.setAttribute('role','status'); const act = document.createElement('div'); act.className = 'ml-act'; act.append(reply, status);
      reply.onclick = async () => {
        if (replying) return; replying = true; reply.disabled = true; status.textContent = '상대의 통신 상태를 확인하는 중…';
        try {
          const res = await window.sllm.replyLetter(id);
          if (!res.ok) { status.textContent = res.error; return; }
          if (openPane) showPane(openPane);
          log('[편지] ' + res.letter.name + ' (' + res.letter.date + ')\n' + res.letter.text);
          if (res.proposal) showProposal(res.proposal);
          log('[안내] 아래 입력칸에서 답장을 보내세요.');
          document.getElementById('q').focus();
        } catch (e) { status.textContent = e.message; }
        finally { replying = false; reply.disabled = false; }
      };
      const back = document.createElement('button'); back.className = 'ml-back'; back.type = 'button';
      { const PK = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k); back.textContent = PK(`◂ 편지 목록 (${letters.length}통)`, `◂ Letter list (${letters.length})`); }
      back.onclick = () => { selected = null; detail.textContent = ''; draw(); };
      detail.append(back, h, body, note, act); detail.scrollTop = 0; draw();
    } catch (e) { detail.textContent = e.message; }
  }
  function open() { if (openPane !== 'mail') showPane('mail'); window.sllm.inbox().then(update); }
  { const ra = document.getElementById('mailReadAll'); if (ra) ra.onclick = async () => { if (!window.sllm.inboxReadAll) return; ra.disabled = true; try { update(await window.sllm.inboxReadAll()); } catch (e) { draw(); } }; } // 열지 않고 모두 읽음(2026-10-18)
  button.onclick = () => { if (openPane === 'mail') showPane('mail'); else open(); };
  document.getElementById('mailbar').onclick = open;
  window.sllm.onShowInbox(open);
  window.sllm.onInboxState(update);
  window.sllm.inbox().then(update);
})();
