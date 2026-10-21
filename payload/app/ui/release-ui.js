(() => {
 const input=document.getElementById('p2ClientId'),status=document.getElementById('p2ClientStatus');
 window.sllm.getSettings().then(s=>{input.value=s.player2ClientId||'';});
 document.getElementById('p2ClientSave').onclick=async()=>{const r=await window.sllm.setPlayer2ClientId(input.value);status.textContent=r.ok?'저장했습니다. Player2 다시 연결을 눌러 확인하세요.':r.error;};
})();