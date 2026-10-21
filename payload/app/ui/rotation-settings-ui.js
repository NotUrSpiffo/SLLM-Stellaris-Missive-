/* Optional settings panel. Host supplies localization, stored settings and IPC save.
 * Contains NO API key access and NO network calls. It does not enable itself.
 * Usage: SLLMRotationSettings.mount(element, { value, primaryModel, pick, save }).
 */
(() => {
  function mount(root, { value = { enabled: false, models: [] }, primaryModel = '', pick, save }) {
    if (typeof pick !== 'function' || typeof save !== 'function') throw new Error('Missing settings host callbacks');
    const L = pick, el = (tag, text) => { const n = document.createElement(tag); if (text) n.textContent = text; return n; };
    root.replaceChildren(); root.classList.add('sllm-rotation-settings');
    const title = el('h3', L('Gemini 모델 자동 전환', 'Gemini model fallback'));
    const label = el('label'), enabled = el('input'); enabled.type = 'checkbox'; enabled.checked = value.enabled === true;
    label.append(enabled, el('span', L('모델별 한도 도달 시 다음 모델 사용', 'Use the next model when a model quota is reached')));
    const hint = el('p', L('현재 연결의 모델만 전환합니다. 모델별 요금과 프로젝트 결제 상태를 확인하세요. 무료 사용을 보장하지 않습니다.', 'Only models on this connection are switched. Check model pricing and project billing. Free usage is not guaranteed.'));
    const modelsLabel = el('label', L('우선순위 순서 · 한 줄에 모델 ID 하나 (최대 8개)', 'Priority order · one model ID per line (up to 8)'));
    const models = el('textarea'); models.rows = 5; models.maxLength = 1607;
    models.value = (value.models.length ? value.models : primaryModel ? [primaryModel] : []).join('\n'); modelsLabel.append(models);
    const note = el('p', L('현재 선택한 모델을 목록에 포함하세요. 한 대화에서는 같은 모델을 우선 유지합니다. 모두 제한되면 대기하며 다른 제공자로 넘어가지 않습니다.', 'Include the currently selected model. A conversation prefers its current model. When all are limited, requests wait; providers are not switched.'));
    const status = el('p'); status.setAttribute('role', 'status');
    const button = el('button', L('전환 설정 저장', 'Save fallback settings')); button.type = 'button';
    let alive = true;
    button.onclick = async () => {
      const list = [...new Set(models.value.split(/\r?\n/).map(x => x.trim()).filter(Boolean))];
      if (list.length > 8 || list.some(x => !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,199}$/.test(x)) || (enabled.checked && (!list.length || !list.includes(primaryModel)))) {
        status.textContent = L('모델 ID와 개수를 확인하고 현재 모델을 목록에 포함해 주세요.', 'Check the model IDs and count, and include the current model.'); return;
      }
      button.disabled = enabled.disabled = models.disabled = true;
      try {
        await save({ enabled: enabled.checked, models: list });
        if (alive) status.textContent = L('저장했습니다.', 'Saved.');
      } catch (_) { if (alive) status.textContent = L('저장하지 못했습니다. 연결 설정을 확인해 주세요.', 'Could not save. Check the connection settings.'); }
      finally { if (alive) button.disabled = enabled.disabled = models.disabled = false; }
    };
    root.append(title, label, hint, modelsLabel, note, button, status);
    return () => { alive = false; root.replaceChildren(); };
  }
  window.SLLMRotationSettings = { mount };
})();
