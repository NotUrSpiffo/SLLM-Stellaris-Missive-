(() => {
  const el=id=>document.getElementById(id),t=s=>window.SLLMI18n?.t(s)||s;
  let snapshot=null,busy=false,previewSequence=0,revision=0;
  const status=message=>{el('supportStatus').textContent=message;};
  function invalidate(){revision++;snapshot=null;previewSequence++;el('supportSave').disabled=true;el('supportReveal').disabled=true;el('supportFiles').replaceChildren();el('supportPreview').value='';status(t('설정이 바뀌었습니다. 로그 묶음을 다시 만들어 주세요.'));}
  for(const id of ['supportSummary','supportSteps','supportOccurred','supportGame','supportRaw'])el(id).addEventListener('input',invalidate);
  async function preview(){if(!snapshot)return;const seq=++previewSequence,id=snapshot.id,name=el('supportFiles').value;try{const r=await window.sllm.supportPreview(id,name);if(seq!==previewSequence)return;el('supportPreview').value=r.ok?r.text:r.error;}catch(e){if(seq===previewSequence)status(String(e.message||e));}}
  el('supportFiles').onchange=preview;
  el('supportPrepare').onclick=async()=>{
    if(busy)return;const preparedRevision=revision;busy=true;el('supportPrepare').disabled=true;el('supportSave').disabled=true;el('supportReveal').disabled=true;status(t('로그를 수집하고 민감 정보를 가리는 중…'));
    try{
      const r=await window.sllm.supportPrepare({summary:el('supportSummary').value,steps:el('supportSteps').value,occurred:el('supportOccurred').value,includeGame:el('supportGame').checked,includeRaw:el('supportRaw').checked});
      if(preparedRevision!==revision)return;if(!r.ok)throw Error(r.error);snapshot=r.report;el('supportFiles').replaceChildren();
      for(const f of snapshot.files){const o=document.createElement('option');o.value=f.name;o.textContent=f.name+' ('+Math.ceil(f.bytes/1024)+' KB)';el('supportFiles').appendChild(o);}
      el('supportSave').disabled=false;status(t('수집 완료. 파일 내용을 확인한 뒤 ZIP으로 저장하세요.')+'\n'+snapshot.id+(snapshot.warnings.length?'\n'+snapshot.warnings.join('\n'):''));await preview();
    }catch(e){snapshot=null;status(String(e.message||e));}finally{busy=false;el('supportPrepare').disabled=false;}
  };
  el('supportSave').onclick=async()=>{
    if(busy||!snapshot)return;busy=true;el('supportSave').disabled=true;
    try{const r=await window.sllm.supportExport(snapshot.id);if(r.canceled){status(t('저장을 취소했습니다.'));return;}if(!r.ok)throw Error(r.error);status(t('ZIP 저장 완료. 이 파일을 개발자에게 직접 전달해 주세요.')+'\n'+r.path);el('supportReveal').disabled=false;}
    catch(e){status(String(e.message||e));}finally{busy=false;el('supportSave').disabled=!snapshot;}
  };
  el('supportReveal').onclick=()=>snapshot&&window.sllm.supportReveal(snapshot.id);
})();
