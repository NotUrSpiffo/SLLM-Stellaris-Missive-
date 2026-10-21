// 집무실 「국가·군가」(2026-10-20 알파 10 앞당김). 앱: src/features/music-app.ts, 규칙: src/music.ts, 애드온 곡: src/addons.ts.
// 곡은 앱 화면에서만 재생한다(게임에는 소리를 넣지 않음). 사용자가 직접 고른 파일이 애드온 팩의 곡보다 앞선다.
// 언어 팩 규칙: 문구는 L('한국어', 'English')(SLLMI18n.pick)으로만.
(() => {
  const L = (k, e) => (window.SLLMI18n && window.SLLMI18n.pick ? window.SLLMI18n.pick(k, e) : k);
  const $ = (id) => document.getElementById(id);
  const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined && text !== null) e.textContent = text; return e; };
  const btn = (cls, text, fn) => { const b = h('button', cls, text); b.type = 'button'; b.onclick = fn; return b; };
  const KINDS = ['anthem', 'march'];
  let V = null, err = '', info = '', busy = false, finding = '', found = null, mark = null, silenceFor = '', editing = '', playing = '', audio = null;
  const show = (id) => { for (const v of document.querySelectorAll('.view')) v.classList.toggle('on', v.id === id); };
  const label = (k) => (k === 'anthem' ? L('국가', 'Anthem') : k === 'march' ? L('군가', 'March') : L('군가', 'March'));
  function stop() { if (audio) { try { audio.pause(); } catch (e) { /* 이미 멈춤 */ } audio = null; } playing = ''; if (mark) { const m = mark; mark = null; try { m.a.pause(); } catch (e) { /* 없음 */ } } }
  function play(kind) {
    const t = V && V.tracks[kind]; if (!t) return;
    if (playing === kind) { stop(); draw(); return; }
    stop(); err = '';
    const a = new Audio(t.url); a.volume = V.volume; audio = a; playing = kind;
    a.onended = () => { if (audio === a) { audio = null; playing = ''; draw(); } };
    a.onerror = () => { if (audio === a) { audio = null; playing = ''; err = L('곡을 재생하지 못했습니다. 파일이 깨졌거나 지원하지 않는 형식일 수 있습니다.', 'Could not play the track. The file may be damaged or in an unsupported format.'); draw(); } };
    a.play().catch(() => { if (audio === a) { audio = null; playing = ''; err = L('곡을 재생하지 못했습니다.', 'Could not play the track.'); draw(); } });
    draw();
  }
  async function load() { try { V = await window.sllm.musicState(); } catch (e) { V = null; } draw(); loadImgs(); }
  async function call(fn) { info = ''; try { const r = await fn(); if (r && r.view) V = r.view; err = r && r.ok === false ? (r.error || '') : ''; if (r && r.notice) info = r.notice; } catch (e) { err = String((e && e.message) || e); } draw(); }
  // 출정 의식: 미리 보기·연출 설정·그림 폴더
  let cimg = null;
  async function loadImgs() { try { cimg = await window.sllm.ceremonyImages(); } catch (e) { cimg = null; } draw(); }
  function ceremonyPanel() {
    const box = h('div', 'mu-cer'), fx = V.ceremony || { darkness: 0.62, embers: true, drone: true, persp: false, askPause: true };
    box.append(h('div', 'mu-fh', L('선언문 발표 연출 — 선언문 전문 뒤에 깃발과 출항 함대를 표시합니다', 'Declaration presentation — your full address, followed by the flag and departing fleets')));
    const row = h('div', 'mu-acts');
    row.append(btn('mu-btn', L('그림 폴더 열기', 'Open image folder'), () => call(() => window.sllm.ceremonyOpenFolder())));
    box.append(row);
    const im = h('div', 'mu-imgs');
    const nm = { march: L('출정하는 병사들', 'Soldiers departing'), speech: L('연설하는 통치자', 'Ruler addressing troops'), fleet: L('함대 발진', 'Fleet launch') };
    for (const k of ['march', 'speech', 'fleet']) im.append(h('span', 'mu-tag' + (cimg && cimg[k] ? ' ok' : ' no'), (cimg && cimg[k] ? '✓ ' : '○ ') + nm[k] + ' (' + k + ')'));
    box.append(im, h('p', 'mu-note', L('그림 폴더에 march·speech·fleet 이름의 png·jpg·webp 를 넣으면 쓰입니다(4K 까지, 가운데 세로 띠는 비워 두면 글이 잘 보입니다). 없으면 빛줄기 배경으로 대신합니다.', 'Put png, jpg or webp files named march, speech and fleet in the image folder (up to 4K; keep the central vertical band clear for the text). Without them a light-ray backdrop is used.')));
    const opt = h('div', 'mu-opt');
    const chk = (label, key) => { const w = h('label', 'mu-of'), c = h('input'); c.type = 'checkbox'; c.checked = !!fx[key]; c.onchange = () => call(() => window.sllm.musicCeremonyFx({ [key]: c.checked })); w.append(c, h('span', '', label)); return w; };
    const dk = h('label', 'mu-of'), sl = h('input'); sl.type = 'range'; sl.min = '35'; sl.max = '85'; sl.value = String(Math.round(fx.darkness * 100)); const dv = h('span', '', Math.round(fx.darkness * 100) + '%');
    sl.oninput = () => { dv.textContent = sl.value + '%'; }; sl.onchange = () => call(() => window.sllm.musicCeremonyFx({ darkness: sl.value / 100 })); dk.append(h('span', '', L('어두움', 'Darkness')), sl, dv);
    opt.append(dk, chk(L('불씨', 'Embers'), 'embers'), chk(L('원근 자막', 'Perspective crawl'), 'persp'));
    box.append(opt, h('p', 'mu-note', L('의식 중에도 게임은 계속 돌아갑니다(앱이 게임을 멈출 수 없음). ESC 나 두 번 클릭으로 건너뜁니다.', 'The game keeps running during the ceremony (the app cannot pause it). Press ESC or double-click to skip.')));
    return box;
  }
  function card(kind) {
    const t = V.tracks[kind], c = h('section', 'mu-card'), mine = !!(t && t.source === 'user');
    c.append(h('div', 'mu-ph', label(kind)));
    if (t) {
      const row = h('div', 'mu-row');
      if (t.url) row.append(btn('mu-play', playing === kind ? L('멈춤', 'Stop') : L('재생', 'Play'), () => play(kind)));
      row.append(h('b', 'mu-name', t.title || label(kind))); c.append(row);
      if (t.lyrics) { const d = h('details', 'mu-lyr'); d.append(h('summary', '', L('가사', 'Lyrics')), h('pre', '', t.lyrics)); c.append(d); }
    } else c.append(h('p', 'mu-empty', L('설정된 곡이 없습니다.', 'No track selected.')));
    const acts = h('div', 'mu-acts');
    acts.append(btn('mu-btn', L('파일 고르기', 'Choose file'), () => { stop(); call(() => window.sllm.musicPick(kind)); }));
    if (mine) {
      acts.append(btn('mu-btn', L('제목·가사 고치기', 'Edit title & lyrics'), () => { editing = editing === kind ? '' : kind; draw(); }));
      acts.append(btn('mu-btn', L('내 파일 빼기', 'Remove my file'), () => { stop(); editing = ''; call(() => window.sllm.musicClear(kind)); }));
    }
    c.append(acts);
    if (mine && editing === kind) {
      const ed = h('div', 'mu-edit'), ti = h('input'), ly = h('textarea'); ti.value = t.title || ''; ti.maxLength = 80; ly.value = t.lyrics || ''; ly.rows = 8;
      ti.setAttribute('aria-label', L('제목', 'Title')); ly.setAttribute('aria-label', L('가사', 'Lyrics'));
      ed.append(ti, ly, btn('mu-btn', L('저장', 'Save'), () => { editing = ''; call(() => window.sllm.musicEdit(kind, ti.value, ly.value)); })); c.append(ed);
    }
    return c;
  }
  function draw() {
    const root = $('musicRoot'); if (!root || !$('music').classList.contains('on')) return; root.textContent = ''; root.dataset.i18nSkip = '';
    { const tt = $('musicTitle'); if (tt) tt.textContent = L('국가·군가', 'Anthem & March'); }
    const wrap = h('div', 'mu-main'); root.append(wrap);
    if (!V) { wrap.append(h('p', 'mu-empty', L('불러오는 중…', 'Loading…'))); return; }
    wrap.append(h('p', 'mu-intro', L('국가와 군가를 설정합니다. 선언문 발표에는 군가가 사용되며, 곡이 없으면 소리 없이 진행됩니다.', 'Choose your anthem and march. Declaration presentations play the march, or remain silent if none is selected.')));
    const vol = h('div', 'mu-vol'), sl = h('input'); sl.type = 'range'; sl.min = '0'; sl.max = '100'; sl.value = String(Math.round(V.volume * 100)); sl.setAttribute('aria-label', L('음량', 'Volume'));
    const vv = h('span', '', Math.round(V.volume * 100) + '%');
    sl.oninput = () => { vv.textContent = sl.value + '%'; if (audio) audio.volume = sl.value / 100; };
    sl.onchange = () => { V.volume = sl.value / 100; window.sllm.musicVolume(sl.value / 100).catch(() => {}); };
    vol.append(h('span', '', L('음량', 'Volume')), sl, vv); wrap.append(vol);
    if (err) wrap.append(h('div', 'mu-err', err));
    if (info) wrap.append(h('div', 'mu-note', info));
    for (const k of KINDS) wrap.append(card(k));
    wrap.append(ceremonyPanel());
  }
  function build() {
    const after = $('spyCall') || $('embCall'); const holo = $('policy') && $('policy').parentElement;
    if (!after || !holo || $('music')) return false;
    const b = h('button', 'ic'); b.type = 'button'; b.id = 'musicCall';
    b.innerHTML = '<svg viewBox="0 0 48 48" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 36V12l22-4v24"/><circle cx="13" cy="36" r="5"/><circle cx="35" cy="32" r="5"/></svg>';
    b.append(h('span', '', L('국가·군가', 'Anthem & March')));
    b.onclick = () => { show('music'); load(); };
    after.after(b);
    const sec = h('section', 'view app'); sec.id = 'music'; sec.setAttribute('aria-label', L('국가·군가', 'Anthem & March'));
    const hd = h('div', 'apph'), back = h('button', 'back', '‹ ' + L('바탕화면', 'Desktop')); back.type = 'button'; back.onclick = () => { stop(); show('desktop'); };
    const ttl = h('h3', '', L('국가·군가', 'Anthem & March')); ttl.id = 'musicTitle'; hd.append(back, ttl);
    const body = h('div', 'appb'); body.id = 'musicRoot'; sec.append(hd, body); holo.append(sec);
    return true;
  }
  document.addEventListener('DOMContentLoaded', () => {
    // 첩보 아이콘 뒤에 붙인다(대사관 화면이 먼저 아이콘을 만들 때까지 잠깐 기다림).
    let tries = 0; const t = setInterval(() => { if (build() || ++tries > 30) clearInterval(t); }, 100);
    document.addEventListener('sllm-language', () => { const b = $('musicCall'); if (b) b.querySelector('span').textContent = L('국가·군가', 'Anthem & March'); draw(); });
    window.addEventListener('pagehide', stop);
  });
  window.SLLMMusic = { load };
})();
