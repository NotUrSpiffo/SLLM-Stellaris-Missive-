(() => {
  const button = document.getElementById('btnContacts'), list = document.getElementById('contactList');
  const search = document.getElementById('contactSearch'), status = document.getElementById('contactStatus'), reload = document.getElementById('contactReload');
  const led = document.getElementById('tmLed'), ledT = document.getElementById('tmLedT'), bars = document.getElementById('tmBars');
  let state = { sid: '', date: '', items: [] }, busy = false, dialing = 0, linked = 0, scanning = false;
  const typeName = (t, g) => (g === 1 ? '기계 지성' : g === 2 ? '군집 의식' : t === 'fallen_empire' ? '몰락 제국' : t === 'awakened_fallen_empire' ? '각성 제국' : '제국');
  const T = (s) => (window.SLLMI18n ? window.SLLMI18n.t(s) : s); // .tm-name 은 자동 번역 제외 칸이라 고정 문구만 직접 번역
  const rel = (s) => Math.max(-1, Math.min(1, s / 200)); // 관계 점수를 막대 길이로(±200 이상은 끝까지)
  const ch = (n) => 'CH ' + String(n).padStart(2, '0');
  function lamp() {
    const cls = scanning || dialing ? 'busy' : state.sid ? 'on' : '';
    led.className = 'tm-led ' + cls; bars.classList.toggle('on', !!state.sid);
    ledT.textContent = scanning ? '스캔 중' : dialing ? '호출 중' : state.sid ? '수신 ' + state.items.length + '채널' : '신호 없음';
  }
  function empty(box, title, text) { const d = document.createElement('div'); d.className = 'tm-empty'; const b = document.createElement('b'); b.textContent = title; d.append(b, text); box.appendChild(d); }
  function draw() {
    list.textContent = ''; lamp();
    const term = search.value.trim().toLocaleLowerCase();
    const all = state.items.map((c, i) => ({ c, n: i + 1 }));
    const items = all.filter(({ c }) => c.name.toLocaleLowerCase().includes(term));
    if (!items.length) empty(list, term ? '일치하는 채널 없음' : state.sid ? '수신 가능한 채널 없음' : '신호 없음',
      term ? '검색어를 바꿔 보세요.' : state.sid ? '첫 조우를 마친 뒤 채널 스캔을 눌러 주세요.' : '게임을 불러온 뒤 채널 스캔을 누르세요. 이후 게임 날짜로 매달 자동 수신합니다.');
    for (const { c, n } of items) {
      const row = document.createElement('div'); row.className = 'tm-row' + (dialing === c.idx ? ' dialing' : '') + (linked === c.idx ? ' linked' : '');
      const chEl = document.createElement('div'); chEl.className = 'tm-ch'; const avc = document.createElement('div'); avc.className = 'tm-av'; avc.textContent = (c.name.trim()[0] || '?').toUpperCase(); const chs = document.createElement('span'); chs.textContent = ch(n); chEl.append(avc, chs);
      const nm = document.createElement('div'); nm.className = 'tm-name'; const b = document.createElement('b'); b.textContent = c.name; b.title = c.name; const sm = document.createElement('small'); sm.textContent = T(typeName(c.type, c.gest)) + ' · ' + T(c.talkOnly ? '대화 전용' : '통신 가능'); if (c.talkOnly) sm.title = T('이 나라는 대화만 할 수 있습니다. 조약·선전포고 같은 게임 행동은 보내지 않습니다.'); nm.append(b, sm);
      const rb = document.createElement('div'); rb.className = 'tm-relbox'; const bar = document.createElement('div'); bar.className = 'tm-rel'; const fill = document.createElement('i'); const r = rel(c.score);
      fill.className = r < 0 ? 'neg' : ''; fill.style.left = (r < 0 ? 50 + r * 50 : 50) + '%'; fill.style.width = Math.abs(r) * 50 + '%'; bar.appendChild(fill);
      const rl = document.createElement('div'); rl.className = 'tm-rel-l'; rl.textContent = '관계 ' + Math.round(c.score); rb.append(bar, rl);
      const call = document.createElement('button'); call.className = 'tm-call'; call.textContent = dialing === c.idx ? '호출 중…' : linked === c.idx ? '연결됨' : '▶ 호출'; call.disabled = busy;
      call.onclick = async () => {
        if (busy) return; busy = true; dialing = c.idx; linked = 0; draw(); status.textContent = c.name + ' 채널(' + ch(n) + ') 호출 중…';
        try {
          const res = await window.sllm.contactDial({ sid: state.sid, idx: c.idx });
          if (!res.ok) status.textContent = '호출 실패: ' + res.error; else { linked = c.idx; status.textContent = '통신 연결됨: ' + c.name; }
        } catch (e) { status.textContent = '호출 실패: ' + e.message; }
        finally { busy = false; dialing = 0; draw(); }
      };
      row.append(chEl, nm, rb, call); list.appendChild(row);
    }
  }
  function update(s) { state = s; if (linked && !state.items.some(c => c.idx === linked)) linked = 0; draw(); if (!busy && !scanning) status.textContent = state.sid ? `수신 완료 · ${state.items.length}채널 · ${state.date || '날짜 확인 중'}` : '대기 중…'; }
  button.onclick = () => { if(openPane!=='contacts')showPane('contacts'); window.sllm.contactsList().then(update); };
  search.oninput = draw;
  reload.onclick = async () => {
    if (busy) return; busy = true; scanning = true; reload.disabled = true; draw(); status.textContent = '게임에서 채널을 스캔하는 중…';
    try { const r = await window.sllm.contactsRefresh(); if (!r.ok) status.textContent = '스캔 실패: ' + r.error; else { state = r.state; status.textContent = `스캔 완료 · ${state.items.length}채널 · ${state.date}`; } }
    catch (e) { status.textContent = '스캔 실패: ' + e.message; }
    finally { busy = false; scanning = false; reload.disabled = false; draw(); }
  };
  window.sllm.onContacts(update);
  window.sllm.contactsList().then(update);
  if (!SETWIN) showPane('contacts');
})();
