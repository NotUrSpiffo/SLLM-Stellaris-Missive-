let spyImages={images:{},defaults:{}};
function spyPortrait(img,cls,name,player){const url=(player&&spyImages.images['ruler:player'])||spyImages.images['country:'+name]||SLLMVariant.pick(spyImages.images,['class:'+cls],name||cls,spyImages.defaults[cls]);if(url){if(img.src!==url)img.src=url;}else img.removeAttribute('src');img.alt=name;}
function renderSpyScene(v){const s=v.state,hearing=s.route==='face',press=s.route==='press';document.getElementById('sceneCourt').hidden=!hearing;document.getElementById('pressView').hidden=!press;
 document.getElementById('playerName').textContent=bi('플레이어 제국','Player empire');document.getElementById('opponentName').textContent=s.incident.opponent;
 spyPortrait(document.getElementById('hostPortrait'),'human','',true);spyPortrait(document.getElementById('opponentPortrait'),'arthropoid',s.incident.opponent);
 document.getElementById('courtCurrent').textContent=s.phase==='finished'?bi('심리 종료','Hearing concluded'):bi(`증거 ${s.current+1} / 3 · 남은 발언 ${3-(s.evidence[s.current]?.turns||0)}회`,`Exhibit ${s.current+1} / 3 · ${3-(s.evidence[s.current]?.turns||0)} statements left`);
 document.getElementById('courtSubject').textContent=s.evidence[s.current]?.title||bi('최종 판정','Final ruling');
 const courtLine=[...s.log].reverse().find(l=>l.who==='은하재판소');document.getElementById('courtQuote').hidden=true;
 spyPortrait(document.getElementById('pressSpeaker'),'human','',true);
}
document.addEventListener('DOMContentLoaded',()=>window.sllm.getImageState().then(v=>{spyImages=v||spyImages;if(currentView)renderSpyScene(currentView);}).catch(()=>{}));
