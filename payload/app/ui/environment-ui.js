(() => {
  const info = document.getElementById('environmentInfo');
  const T = (x) => (window.SLLMI18n ? window.SLLMI18n.t(x) : x); // 영어·언어 팩 화면에서도 점검 줄이 번역되게(2026-10-18)
  let lastR = null;
  async function draw(r) {
    lastR = r;
    info.textContent = '';
    if(typeof r.setupDone==='boolean'){document.getElementById('setupIntro').hidden=r.setupDone;document.getElementById('terminalSetupNotice').hidden=SETWIN||r.setupDone;}
    const line = (label, value, ok) => { const d=document.createElement('div'); d.textContent=(ok?'✓ ':'○ ')+T(label)+': '+(value || T('찾지 못함')); info.appendChild(d); };
    line('게임 사용자 폴더', r.userDir, r.userExists);
    line('게임 로그', r.log, r.logExists);
    line('연결 모드', r.mod, r.modExists);
    line('게임 설치', r.game, r.gameExists);
    line('세이브', r.latestSave, !!r.latestSave);
    const vb=document.getElementById('verBanner'),vc=r.versionCheck;
    if(vb){const bad=vc&&(vc.status==='mod_newer'||vc.status==='mod_older');vb.hidden=!bad;vb.className=vc&&vc.status==='mod_older'?'old':'';vb.textContent=bad?'⚠ '+vc.message:'';}
    if(vc&&vc.modVersion)line('연결 모드 버전',vc.modVersion+' ('+T(vc.source==='game'?'게임 응답':'모드 폴더')+')'+(vc.message?' — '+vc.message:''),vc.status==='same');
    line('앱 / 연결 규격', r.appVersion+' / '+r.protocol, true);
    line('실행 중 모드 응답', r.runtime ? r.runtime.version+' / '+T('규격')+' '+r.runtime.protocol+' ('+T(r.runtime.verified?'직접 응답 확인':'로그에서 확인')+')' : T('게임에서 연결 확인을 누르세요'), !!r.runtime && r.runtime.protocol===r.protocol);
    for(const h of (r.hints||[])){const d=document.createElement('p');d.textContent=(h.level==='warn'?'⚠ ':'ℹ ')+T(h.text);info.appendChild(d);}
    if(r.display==='exclusive'&&window.sllm.displayFix){const b=document.createElement('button');b.textContent=T('테두리 없는 전체화면으로 바꾸기');b.onclick=async()=>{b.disabled=true;try{draw(await window.sllm.displayFix());}finally{b.disabled=false;}};info.appendChild(b);} // 독점 전체화면 → 앱 창이 떠도 게임이 안 내려가게
    if(r.note){const d=document.createElement('p');d.textContent=String(r.note).split(' · ').map(T).join(' · ');info.appendChild(d);}
  }
  const reload = () => window.sllm.environmentInfo().then(draw);
  for(const [id,kind] of [['pickUserDir','user'],['pickModDir','mod']])document.getElementById(id).onclick=async()=>draw(await window.sllm.environmentPick(kind));
  document.getElementById('autoEnvironment').onclick=async()=>draw(await window.sllm.environmentReset());
  document.getElementById('checkEnvironment').onclick=async()=>{
    const b=document.getElementById('checkEnvironment');b.disabled=true;info.textContent=T('게임과 Player2 연결 확인 중…');
    try {await draw(await window.sllm.environmentCheck());}catch(e){info.textContent=e.message;}finally{b.disabled=false;}
  };
  document.getElementById('setupDone').onclick=async()=>{await window.sllm.environmentDone();document.getElementById('setupIntro').hidden=true;};
  document.getElementById('terminalSetupSettings').onclick=()=>window.sllm.launcherClick('set');
  window.sllm.onEnvironment(draw);
  document.addEventListener('sllm-language', () => { if (lastR) draw(lastR); });
  reload();
  window.sllm.getSettings().then(st=>{
    if(st.setupDone)document.getElementById('setupIntro').hidden=true;
    document.getElementById('terminalSetupNotice').hidden=SETWIN||st.setupDone===true;
    if(SETWIN&&!st.setupDone)selectSettingsCategory(document.getElementById('settings-tab-game'));
  });
})();
