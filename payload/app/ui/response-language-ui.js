(() => {
  const mode = document.getElementById('responseLanguageMode'), input = document.getElementById('responseLanguageName');
  const save = document.getElementById('responseLanguageSave'), status = document.getElementById('responseLanguageStatus');
  const t = s => window.SLLMI18n ? window.SLLMI18n.t(s) : s;
  function update(s) {
    if (document.activeElement !== input) input.value = s.aiLanguage || '';
    mode.value = s.aiLanguage ? 'custom' : 'interface'; input.hidden = mode.value !== 'custom';
  }
  mode.onchange = () => { input.hidden = mode.value !== 'custom'; status.textContent = ''; if (!input.hidden) input.focus(); };
  input.oninput = () => { status.textContent = ''; };
  async function apply() {
    if (save.disabled) return;
    const value = mode.value === 'custom' ? input.value.trim() : '';
    if (mode.value === 'custom' && !value) { status.textContent = t('AI 응답 언어를 입력해 주세요.'); return; }
    save.disabled = true;
    try {
      const r = await window.sllm.setAiLanguage(value);
      if (!r.ok) { status.textContent = t(r.error); return; }
      update(r); status.textContent = t('저장했습니다. 이후 생성되는 AI 응답부터 적용됩니다.');
    } catch (e) { status.textContent = e.message; }
    finally { save.disabled = false; }
  }
  save.onclick = apply;
  input.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); apply(); } };
  window.sllm.getSettings().then(update);
  window.sllm.onLanguageChanged(update);
})();
