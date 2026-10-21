/* Real campaign host: no preview saves, demo affinity or automatic AI requests. */
(() => {
 const L=(k,e)=>window.SLLMI18n?.pick(k,e)||k;
 const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;return x;};
 const themes=['authoritarian','egalitarian','xenophile','xenophobe','militarist','pacifist','spiritualist','materialist'];
 let opening=false,tvTimer=null,tvSnapshot=null;
 function stopTV(){clearTimeout(tvTimer);tvTimer=null;tvSnapshot=null;}
 let root,stage,toolbar,title,status,state,style,room='corridor',view='room',corridor,seq=0,dialog,dirty=false,chatPanel;
 const base='assets/private-rooms/';
 const musicAudio=new Audio();musicAudio.volume=.4;let musicWanted=false,musicData={tracks:[],prefs:{volume:.4,loop:false,autoplay:false,selectedId:''}};
 musicAudio.onended=()=>{if(!musicAudio.loop)musicWanted=false;};
 function stopMusic(){musicAudio.pause();musicAudio.currentTime=0;musicWanted=false;}
 function applyMusic(r){if(!r.ok)throw Error(r.error);musicData=r;musicAudio.volume=r.prefs.volume;musicAudio.loop=r.prefs.loop;const t=r.tracks.find(t=>t.id===r.prefs.selectedId);if(!t){stopMusic();musicAudio.removeAttribute('src');}else if(musicAudio.src!==t.url){musicAudio.pause();musicAudio.src=t.url;}return t;}
 async function configureMusic(p){const r=await window.sllm.roomsMusicConfigure(state.token,p);applyMusic(r);return r;}
 async function playMusic(){if(!musicAudio.src||room!=='private'||view==='sofa')return;musicWanted=true;try{await musicAudio.play();}catch(e){musicWanted=false;message(L('음악을 재생하지 못했습니다.','Could not play the audio.'));}}
 musicAudio.onerror=()=>{musicWanted=false;message(L('음악을 재생하지 못했습니다.','Could not play the audio.'));};
 const labels={corridor:()=>L('집무실 복도','Office corridor'),private:()=>L('통치자 개인실','Private room'),reading:()=>L('독서실','Library'),exhibition:()=>L('전시실','Gallery'),secretary:()=>L('비서실','Secretary’s office')};
 const button=(text,fn,parent=toolbar)=>{const b=el('button','',text);b.type='button';b.onclick=()=>{try{Promise.resolve(fn()).catch(e=>message(e.message));}catch(e){message(e.message);}};parent.append(b);return b;};
 function message(t){status.textContent=t||'';}
 function closeDialog(){if(dirty&&!confirm(L('저장하지 않은 변경을 버릴까요?','Discard unsaved changes?')))return false;dialog?.remove();dialog=null;dirty=false;return true;}
 function close(){if(!closeDialog())return;void window.sllm.roomsCompanion(state.token,'leave').catch(()=>{});stopTV();stopMusic();seq++;corridor?.destroy();corridor=null;root?.remove();root=null;chatPanel=null;document.getElementById('roomsCall')?.focus();}
 async function refresh(){const r=await window.sllm.roomsState();if(!r.ok)throw Error(r.error);if(state&&r.token!==state.token)throw Error(L('세이브나 통치자가 바뀌었습니다. 방을 다시 열어 주세요.','The save or ruler changed. Reopen the room.'));state=r;drawShelves();return r;}
 function asset(src,cls='rooms-background'){const img=el('img',cls);img.src=base+src;img.alt='';stage.append(img);return img;}
 function theme(){return themes.includes(style?.applied)?style.applied:'authoritarian';}
 function hot(label,rect,fn){const b=button(label,fn,stage);b.className='rooms-hot';b.style.cssText=`left:${rect[0]}%;top:${rect[1]}%;width:${rect[2]}%;height:${rect[3]}%`;b.title=label;b.setAttribute('aria-label',label);return b;}
 const shelfSpecs=[['lore',3.3,16.5],['species',23.6,16],['history',43.1,13.6],['writing',60,10.8]],shelfPages={lore:0,species:0,history:0,writing:0};
 // Library shelves: every saved (non-deleted) book stands as a spine on its category shelf, 12 per shelf page (2 rows × 6).
 function drawShelves(){
  if(!root||!stage||room!=='reading'||view!=='room')return;stage.querySelector('.rooms-shelves')?.remove();
  const layer=el('div','rooms-shelves');layer.dataset.i18nSkip='';stage.append(layer);
  const books=(state.records||[]).filter(r=>r.kind==='book'&&!r.deleted);
  for(const [key,left,width] of shelfSpecs){
   const name=recordCategories().find(x=>x[0]===key)[1],list=books.filter(b=>b.category===key),count=Math.max(1,Math.ceil(list.length/12)),n=list.length;
   shelfPages[key]=Math.max(0,Math.min(shelfPages[key],count-1));const at=shelfPages[key];
   const bar=el('div','rooms-shelf-controls');bar.style.left=left+'%';bar.style.width=width+'%';layer.append(bar);
   button(name+' · '+L(`${n}권`,`${n} books`),()=>recordList('book',key),bar);
   if(count>1){
    const prev=button('‹',()=>{shelfPages[key]--;drawShelves();},bar);prev.disabled=at===0;prev.setAttribute('aria-label',L(`${name} 이전 서가`,`Previous ${name} shelf`));
    bar.append(el('small','',`${at+1}/${count}`));
    const next=button('›',()=>{shelfPages[key]++;drawShelves();},bar);next.disabled=at===count-1;next.setAttribute('aria-label',L(`${name} 다음 서가`,`Next ${name} shelf`));
   }
   list.slice(at*12,at*12+12).forEach((book,index)=>{
    const b=el('button','rooms-spine');b.type='button';const step=(width-.8)/6;b.style.left=(left+.4+(index%6)*step)+'%';b.style.width=(step*.92)+'%';b.style.bottom=(100-(index<6?25.3:47.8))+'%';
    let hash=0;for(const c of book.id)hash=(hash*31+c.charCodeAt(0))>>>0;b.style.height=(15+(hash%25)/10)+'%';b.style.setProperty('--spine-hue',((hash>>>5)%40-20)+'deg');
    const art=el('span','rooms-spine-art'),img=el('img');img.src=base+'library/book-spine-v2.webp';img.alt='';img.draggable=false;art.append(img);
    b.append(art,el('span','rooms-spine-title',book.title));b.setAttribute('aria-label',L(`「${book.title}」 읽기`,`Read “${book.title}”`));
    b.onclick=()=>read(book,0);layer.append(b);
   });
  }
 }
 async function go(next,sub='room'){
  if(!closeDialog())return;void window.sllm.roomsCompanion(state.token,'leave').catch(()=>{});stopTV();seq++;corridor?.destroy();corridor=null;chatPanel?.remove();chatPanel=null;
  const entering=next==='private'&&room!=='private';
  if(next!=='private')stopMusic();else if(sub==='sofa')musicAudio.pause();
  room=next;view=sub;
  if(entering){const ticket=seq;const data=await window.sllm.roomsMusic(state.token);if(!root||seq!==ticket)return;applyMusic(data);musicWanted=!!musicData.prefs.autoplay&&!!musicAudio.src;}
  if(next==='private'&&sub!=='sofa'&&musicWanted)await playMusic();stage.replaceChildren();toolbar.replaceChildren();message('');title.textContent=labels[room]();
  if(next==='corridor'){
   corridor=window.SLLMCorridorArt.mount(stage,{assetBase:base+'corridor',pick:L,onRoom:id=>id==='office'?close():go(id)});await corridor.update(style);
   button(L('집무실로 돌아가기','Return to office'),close);return;
  }
  button(L('‹ 복도','‹ Corridor'),()=>go('corridor'));
  if(next==='private'){
   if(sub==='sofa'){showSecretaryTV(true);return;}
   asset('private/'+theme()+'-'+sub+'.webp');
   if(sub==='room'){
    hot(L('축음기','Gramophone'),[53,58,9,15],()=>musicPanel());
    hot(L('개인 일지','Personal journal'),[39,55,12,18],()=>recordList('journal'));
    hot(L('창가에 앉기','Sit by the window'),[65,37,15,30],()=>go('private','window'));
    hot(L('소파에 앉기','Sit on the sofa'),[9,42,25,30],()=>go('private','sofa'));
   }else button(L('일어나기','Stand up'),()=>go('private'));
   button(L('개인 일지','Personal journal'),()=>recordList('journal'));
   button(L('축음기','Gramophone'),()=>musicPanel());
  }else if(next==='reading'){
   asset('library/reading-room-empty-v2.webp');
   hot(L('새 글 쓰기','Write a book'),[76,63,22,10],()=>edit(null,'book'));
   drawShelves();
   button(L('책장 열기','Browse books'),()=>recordList('book'));
   button(L('새 글 쓰기','Write a book'),()=>edit(null,'book'));
  }else if(next==='exhibition'){
   asset('gallery/gallery-wall.webp');
   button(L('트로피 보관함','Trophy collection'),()=>trophyPanel());
   drawTrophies();
  }else if(next==='secretary'){
   if(sub==='tv'){showSecretaryTV();return;}
   asset('secretary/room-'+theme()+'.webp');
   hot(L('TV 시청','Watch TV'),[59,15,23,28],()=>go('secretary','tv'));
   button(L('TV 시청','Watch TV'),()=>go('secretary','tv'));
   button(L('선물한 트로피','Gifted trophies'),()=>trophyPanel('secretary'));
   stage.style.setProperty('--room-brightness',({authoritarian:.86,egalitarian:1.04,xenophile:1,xenophobe:.76,militarist:.86,pacifist:1.03,spiritualist:.84,materialist:.96})[theme()]);
   if(state.secretary.ready){asset('secretary/secretary-seated.webp','rooms-secretary');asset('secretary/room-'+theme()+'.webp','rooms-desk');asset('secretary/work-hologram.webp','rooms-hologram');}
  }
  const min=next==='private'?20:next==='secretary'?0:10;
  const b=button(L('비서와 이야기하기','Talk with your secretary'),()=>chat());
  b.disabled=!state.secretary.ready||(min>0&&!(state.secretary.aff>=min));
  if(b.disabled)b.title=L('현재 통치자와의 관계 조건을 충족해야 합니다.','The current ruler must meet the relationship requirement.');
 }
 function showSecretaryTV(privateSofa=false){
  let companionPose='alone';
  const art=privateSofa?'private/'+theme()+'-sofa.webp':'secretary-tv/tv-'+theme()+'.webp';const backdrop=asset(art);
  const screen=asset('secretary-tv/broadcast.webp','rooms-tv-screen');screen.hidden=true;if(privateSofa)screen.classList.add('rooms-sofa-tv');
  if(!privateSofa&&state.secretary.ready){asset('secretary-tv/secretary-back.webp','rooms-tv-secretary');asset(art,'rooms-tv-chair');asset(art,'rooms-tv-desk');}
  const caption=el('section','rooms-tv-caption');caption.dataset.i18nSkip='';stage.append(caption);
  if(privateSofa){
   button(L('일어나기','Stand up'),()=>go('private'));
   const call=button(L('비서 부르기','Call your secretary'),()=>changeCompanion('call'));
   const sit=button(L('옆에 앉으세요','Please sit beside me'),()=>changeCompanion('sit'));sit.disabled=true;
   const dismiss=button(L('동행 마치기','End company'),()=>changeCompanion('leave'));dismiss.disabled=true;
   call.disabled=!state.secretary.ready||!(state.secretary.aff>=20);
   async function changeCompanion(action){const r=await window.sllm.roomsCompanion(state.token,action);if(!root||seq!==ticket)return;if(!r.ok){message(r.error);return;}companionPose=r.pose;call.disabled=r.pose!=='alone';sit.disabled=r.pose!=='standing';dismiss.disabled=r.pose==='alone';
    stage.querySelectorAll('.rooms-sofa-companion,.rooms-sofa-front').forEach(x=>x.remove());if(r.pose!=='alone'){asset('private-tv/'+r.pose+'-cut.png','rooms-sofa-companion');asset(art,'rooms-sofa-front');}
    screen.classList.toggle('rooms-sofa-tv',true);chatPanel?.remove();chatPanel=null;await update();
   }
  }else button(L('비서실로 돌아가기','Return to secretary’s office'),()=>go('secretary'));
  const play=button(L('라디오 켜기','Turn radio on'),()=>update('play'));
  const stop=button(L('라디오 끄기','Turn radio off'),()=>update('stop'));
  const full=button(L('방송 전문','Broadcast transcript'),()=>{if(!tvSnapshot)return;const d=modal(tvSnapshot.station);if(d)d.append(el('p','rooms-transcript',tvSnapshot.lines.join('\n\n')));});
  const talk=button(L('이 방송에 대해 이야기하기','Discuss this broadcast'),()=>{if(tvSnapshot)chat({broadcastId:tvSnapshot.id});});talk.disabled=true;
  const ticket=seq,token=state.token;
  async function update(action){
   const r=await window.sllm.roomsRadio(token,action);if(!root||seq!==ticket)return;if(!r.ok){message(r.error);return;}
   tvSnapshot=r.broadcast;screen.hidden=!r.state.on;play.disabled=r.state.on;stop.disabled=!r.state.on;full.disabled=!tvSnapshot;talk.disabled=!tvSnapshot||!state.secretary.ready||(privateSofa&&companionPose==='alone');
   caption.replaceChildren(el('strong','',tvSnapshot?.station||L('성간 방송','Interstellar broadcast')),el('p','',tvSnapshot?tvSnapshot.lines.join('\n'):L('아직 수신한 방송이 없습니다. 라디오를 켜면 기존 방송 일정에 따라 수신합니다.','No broadcast received yet. Turning on the radio uses its existing broadcast schedule.')));
   message(r.state.working?L('라디오에서 방송을 준비하고 있습니다.','The radio is preparing a broadcast.'):r.state.on?L('라디오와 같은 방송을 공유합니다. 음성 설정은 라디오 창에서 조절하세요.','Sharing the radio broadcast. Adjust voice settings in the radio window.'):L('라디오가 꺼져 있습니다.','The radio is off.'));
  }
  async function poll(){try{await update();}catch(e){if(seq===ticket)message(e.message);}if(root&&seq===ticket)tvTimer=setTimeout(poll,1500);}
  poll();
 }
 async function drawTrophies(){
  const ticket=seq;const r=await window.sllm.roomsTrophies(state.token);if(!root||seq!==ticket||room!=='exhibition')return;if(!r.ok){message(r.error);return;}stage.querySelectorAll('.rooms-trophy-display').forEach(x=>x.remove());
  for(const t of r.state.items.filter(x=>!x.deleted&&x.owner==='player'&&x.slot!==null)){const b=button(t.details.title,()=>trophyPanel(),stage);b.className='rooms-trophy-display';b.style.left=(8+(t.slot%4)*23)+'%';b.style.top=(16+Math.floor(t.slot/4)*23)+'%';const img=el('img');img.src=base+'gallery/'+t.details.trophy+'.webp';img.alt='';b.prepend(img);}
 }
 async function trophyPanel(owner='player'){
  const d=modal(L('트로피 보관함','Trophy collection'));if(!d)return;let current;const checked=new Map();
  const notice=el('p','rooms-note'),actions=el('nav'),list=el('div','rooms-list');d.append(notice,actions,list);
  const load=async()=>{const r=await window.sllm.roomsTrophies(state.token);if(dialog!==d)return;if(!r.ok){notice.textContent=r.error;return;}current=r.state;draw();};
  const apply=async(t,action,input)=>{const r=await window.sllm.roomsTrophyChange(state.token,current.revision,t.id,action,input);if(!r.ok){notice.textContent=r.error;return;}await load();if(room==='exhibition')drawTrophies();};
  const tab=(text,id)=>button(text,()=>{owner=id;draw();},actions);
  tab(L('내 보관함','My collection'),'player');tab(L('비서 소유','Secretary’s collection'),'secretary');tab(L('보낸 선물','Given gifts'),'given');tab(L('소유 이력','Ownership history'),'history');
  button(L('트로피 제작 · 1,000 EC','Create trophy · 1,000 EC'),()=>editor(),actions);
  const roleName=r=>({governor:L('행성 총독','Planetary governor'),admiral:L('제독','Admiral'),general:L('장군','General'),scientist:L('과학자','Scientist'),commander:L('지휘관','Commander'),official:L('관료','Official')})[r]||'';
  const who=x=>x?.name?(x.kind==='person'?x.name+(roleName(x.role)?' · '+roleName(x.role):'')+' · '+L('우리 제국','Our empire'):x.name+(x.ruler?' · '+x.ruler:'')):L('미확인 수신자','Unknown recipient');
  const card=t=>{const row=el('section','rooms-record rooms-trophy-card'),img=el('img');img.src=base+'gallery/'+t.details.trophy+'.webp';img.alt='';row.append(img,el('strong','',t.details.title),el('small','',L('제작시기 - ','Crafted - ')+(t.creation?.rulerName?L(`${t.creation.rulerName} 재임, ${t.creation.date}`,`during ${t.creation.rulerName}’s reign, ${t.creation.date}`):L('미확인','Unknown'))),el('p','',t.details.body));return row;};
  const recover=async(q,mode)=>{const r=await window.sllm.roomsTrophyCreate(state.token,current.revision,null,q.id,mode);if(!r.ok){notice.textContent=r.error;await load();return;}checked.set(q.id,r.status);await load();
   notice.textContent=r.status==='paid'?L('결제가 확인되어 트로피를 만들었습니다.','Payment confirmed; the trophy was created.'):r.status==='short'?L('에너지 크레딧이 부족해 제작되지 않았습니다.','Insufficient energy credits. No trophy was created.'):r.status==='cancelled'?L('결제되지 않은 요청을 취소했습니다. 차감된 자원은 없습니다.','Cancelled the unpaid request. Nothing was charged.'):L('현재 세이브에서 결제 표시를 찾지 못했습니다. 다시 차감하지 않았습니다.','No payment marker found in the current save. Nothing was charged again.');};
  const actionName=a=>({'payment-requested':L('제작 결제 요청','Crafting payment requested'),'insufficient-energy':L('에너지 부족','Insufficient energy'),'payment-cancelled':L('미결제 요청 취소','Unpaid request cancelled'),created:L('제작','Crafted'),edit:L('수정','Edited'),delete:L('삭제','Deleted'),display:L('전시 변경','Display changed'),gift:L('비서에게 선물','Given to secretary'),reclaim:L('몰수','Reclaimed'),'letter-sent':L('외교 서신 발송','Gift letter sent'),'letter-cancelled':L('서신 전달 취소','Gift letter cancelled'),delivered:L('수신 확정','Receipt confirmed'),'delivery-failed':L('전달 실패 · 반송','Delivery failed · returned')})[a]||a;
  function draw(){list.replaceChildren();list.classList.toggle('rooms-list-rows',owner==='history');if(!current)return;notice.textContent=L('선물·몰수·삭제는 제작비를 환불하지 않습니다.','Gifting, reclaiming and deleting do not refund the crafting cost.');
   for(const q of current.requests.filter(x=>x.status==='pending')){const row=el('div','rooms-record');row.append(el('strong','',q.details.title),el('small','',L('결제 미확인 · 재차감 없이 조회','Unconfirmed payment · check without charging again')));
    button(L('결제 확인','Check payment'),()=>recover(q,'check'),row);
    if(checked.get(q.id)==='missing'){row.append(el('small','',L('게임에 결제 표시가 없습니다. 같은 요청 번호로 다시 보내면 이미 결제된 경우 차감하지 않습니다.','The game has no payment marker. Re-sending the same request never charges twice if it was already paid.')));
     button(L('같은 요청으로 다시 결제','Retry the same request'),async()=>{if(confirm(L('같은 요청 번호로 1,000 EC 결제를 다시 시도할까요?','Retry the 1,000 EC payment with the same request id?')))await recover(q,'retry');},row);
     button(L('요청 취소','Cancel request'),async()=>{if(confirm(L('게임에서 결제 표시가 없음을 다시 확인한 뒤에만 취소합니다. 진행할까요?','The request is cancelled only after the game confirms again that no payment exists. Continue?')))await recover(q,'cancel');},row);}
    list.append(row);}
   if(owner==='history'){
    button(L('원장 JSON 내보내기','Export ledger JSON'),async()=>{const r=await window.sllm.roomsTrophyExport(state.token);if(dialog===d)notice.textContent=r.ok?(r.cancelled?'':L('내보냈습니다.','Exported.')):r.error;},list);
    const rows=current.history.slice().reverse();if(!rows.length)list.append(el('p','',L('기록이 없습니다.','No records yet.')));
    for(const h of rows){const row=el('div','rooms-record rooms-ledger');const item=h.item||h.request;row.append(el('b','',actionName(h.action)+' · '+(item?.details?.title||'')),el('small','',(h.actor?.date||'')+' · '+(h.actor?.rulerName||L('미확인','Unknown'))));
     const to=h.item?.delivery?.to||h.item?.recipient;if(to)row.append(el('small','',L('받는 이: ','To: ')+who(to)));
     if(h.item?.owner)row.append(el('small','',L('소유: ','Owner: ')+({player:L('나','Me'),secretary:L('비서','Secretary'),empire:who(h.item.recipient),person:who(h.item.recipient)})[h.item.owner]));list.append(row);}
    return;}
   const items=current.items.filter(x=>!x.deleted&&(owner==='given'?(x.owner==='empire'||x.owner==='person'):x.owner===owner));
   if(!items.length)list.append(el('p','',owner==='given'?L('서신으로 보낸 트로피가 없습니다.','No trophies have been given by letter.'):L('트로피가 없습니다.','No trophies.')));
   for(const t of items){const row=card(t);
    if(owner==='given'){row.append(el('small','',L('수신 확정 - ','Received - ')+who(t.recipient)+' · '+(t.recipient?.date||'')));if(t.owner==='person')button(L('회수','Take back'),async()=>{if(confirm(L('이 인물에게서 트로피를 회수할까요? 우리 제국에 남아 있는 인물에게서만 회수할 수 있습니다.','Take this trophy back? Only possible while the person still serves our empire.')))await apply(t,'reclaim');},row);}
    else if(owner==='player'&&t.delivery){row.append(el('small','rooms-transit',L(`서신 전달 중 · ${who(t.delivery.to)} · 도착 예정 ${t.delivery.due}`,`In transit by letter · ${who(t.delivery.to)} · arriving ${t.delivery.due}`)));button(L('전달 취소','Cancel delivery'),async()=>{if(!confirm(L('서신 전달을 취소할까요? 트로피는 그대로 내 소유로 남습니다.','Cancel the letter? The trophy stays in your collection.')))return;const r=await window.sllm.roomsTrophyCancelLetter(state.token,current.revision,t.id);if(!r.ok){notice.textContent=r.error;return;}await load();},row);}
    else if(owner==='player'){button(L('수정','Edit'),()=>editor(t),row);button(L('전시','Display'),async()=>{const used=new Set(current.items.filter(x=>!x.deleted&&x.slot!==null).map(x=>x.slot));const slot=Array.from({length:12},(_,i)=>i).find(i=>!used.has(i));if(slot===undefined){notice.textContent=L('전시 칸 12개가 모두 찼습니다.','All 12 display slots are occupied.');return;}await apply(t,'display',slot);},row);if(t.slot!==null)button(L('전시 해제','Remove from display'),()=>apply(t,'display',null),row);
     button(L('비서에게 선물','Give to secretary'),async()=>{if(confirm(L('이 트로피를 비서에게 직접 전달할까요?','Give this trophy directly to your secretary?')))await apply(t,'gift');},row);
     button(L('서신으로 선물','Gift by letter'),()=>sendForm(t),row);
     button(L('삭제','Delete'),async()=>{if(confirm(L('트로피를 삭제할까요? 이력은 보존됩니다.','Delete this trophy? Its history will be preserved.')))await apply(t,'delete');},row);
    }else button(L('몰수','Reclaim'),async()=>{if(confirm(L('이 트로피를 내 보관함으로 회수할까요?','Reclaim this trophy into your collection?')))await apply(t,'reclaim');},row);
    list.append(row);
   }
  }
  async function sendForm(t){list.replaceChildren(card(t));list.classList.add('rooms-list-rows');const pickTo=el('select'),note=el('textarea'),info=el('p','rooms-note');pickTo.setAttribute('aria-label',L('받는 제국','Recipient empire'));note.maxLength=600;note.rows=3;note.placeholder=L('동봉할 짧은 글 (선택)','Short note to enclose (optional)');note.setAttribute('aria-label',note.placeholder);
   const fill=r=>{pickTo.replaceChildren();if(!r.ok){info.textContent=r.error;return;}const group=(label,list,value)=>{if(!list?.length)return;const g=el('optgroup');g.label=label;for(const x of list){const o=el('option','',who(x));o.value=value(x);g.append(o);}pickTo.append(g);};
    group(L('우리 제국 인물','Our empire’s people'),r.people,x=>x.key);group(L('다른 제국 지도자','Other empires’ leaders'),r.targets,x=>String(x.idx));const total=(r.people?.length||0)+r.targets.length;info.textContent=total?L(`도착까지 게임 시간 1개월. 도착할 때 받는 이가 여전히 연락 가능하면(우리 인물은 재직 중이면) 수신이 확정되고 소유권이 넘어갑니다. 다른 제국 연락처 기준일 ${r.contactsDate||'-'}`,`Arrives after one game month. If the recipient is still reachable on arrival (our people: still serving), receipt is confirmed and ownership passes to them. Other empires’ contacts as of ${r.contactsDate||'-'}`):L('선물할 수 있는 연락처가 없습니다. 연락처를 갱신해 주세요.','No giftable contacts. Refresh contacts.');send.disabled=!total;};
   list.append(pickTo,note,info);const nav=el('nav');list.append(nav);
   const send=button(L('서신 봉인 · 발송','Seal and send'),async()=>{const idx=/^(p|adm|gov):/.test(pickTo.value)?pickTo.value:Number(pickTo.value);if(!idx)return;if(!confirm(L('이 트로피를 서신으로 보낼까요? 도착 전까지는 취소할 수 있습니다.','Send this trophy by letter? You can cancel until it arrives.')))return;send.disabled=true;try{const r=await window.sllm.roomsTrophySend(state.token,current.revision,t.id,idx,note.value);if(!r.ok){info.textContent=r.error;return;}current=r.state;draw();notice.textContent=L('서신을 보냈습니다.','The letter was sent.');}finally{send.disabled=false;}},nav);
   button(L('연락처 갱신','Refresh contacts'),async()=>{info.textContent=L('연락처를 갱신하는 중…','Refreshing contacts…');fill(await window.sllm.roomsTrophyTargets(state.token,true));},nav);
   button(L('돌아가기','Back'),draw,nav);
   fill(await window.sllm.roomsTrophyTargets(state.token));
  }
  function editor(t){list.replaceChildren();const title=el('input'),event=el('input'),body=el('textarea'),kind=el('select');for(const [id,k,e] of [['ship','함선','Ship'],['medal','훈장','Medal'],['crystal','수정','Crystal'],['relic','유물','Relic']]){const o=el('option','',L(k,e));o.value=id;kind.append(o);}title.placeholder=L('트로피 이름','Trophy name');event.placeholder=L('기념할 사건','Commemorated event');body.placeholder=L('설명','Description');title.maxLength=120;event.maxLength=300;body.maxLength=5000;title.value=t?.details.title||'';event.value=t?.details.event||'';body.value=t?.details.body||'';kind.value=t?.details.trophy||'ship';for(const x of [title,event,body])x.setAttribute('aria-label',x.placeholder);kind.setAttribute('aria-label',L('모양','Design'));list.append(title,event,body,kind);
   const save=button(t?L('저장','Save'):L('1,000 EC로 제작','Craft for 1,000 EC'),async()=>{save.disabled=true;try{const input={title:title.value,event:event.value,body:body.value,trophy:kind.value};if(t){await apply(t,'edit',input);return;}if(!confirm(L('게임에서 에너지 크레딧 1,000을 지불하고 제작할까요?','Pay 1,000 energy credits in the game to craft this trophy?')))return;const r=await window.sllm.roomsTrophyCreate(state.token,current.revision,input);await load();if(!r.ok)notice.textContent=r.error;else if(r.state.requests.at(-1)?.status==='short')notice.textContent=L('에너지 크레딧이 부족합니다. 제작되지 않았습니다.','Insufficient energy credits. No trophy was created.');}finally{save.disabled=false;}},list);
  }
  await load();
 }
 function modal(label){if(!closeDialog())return null;dialog=el('section','rooms-dialog');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',label);dialog.dataset.i18nSkip='';const head=el('header');head.append(el('strong','',label));button('×',closeDialog,head).setAttribute('aria-label',L('닫기','Close'));dialog.append(head);root.append(dialog);return dialog;}
 async function musicPanel(){
  const d=modal(L('축음기','Gramophone'));if(!d)return;
  const note=el('p','rooms-note',L('선택한 음악만 재생합니다. 소파에서는 잠시 멈추고, 개인실을 나가면 정지합니다.','Only your selected music plays. The sofa pauses playback; leaving the room stops it.'));
  const list=el('div','rooms-list'),controls=el('nav');d.append(note,list,controls);
  const draw=r=>{applyMusic(r);list.replaceChildren();for(const t of r.tracks){const row=el('div','rooms-record');row.append(el('span','',t.name));button((r.prefs.selectedId===t.id?'✓ ':'')+L('선택 · 재생','Select · Play'),async()=>{await configureMusic({selectedId:t.id});await playMusic();draw(musicData);},row);button(L('삭제','Delete'),async()=>{if(!confirm(L('보관한 음악을 삭제할까요? 원본 파일은 유지됩니다.','Delete the stored copy? The original file will remain.')))return;draw(await window.sllm.roomsMusicDelete(state.token,t.id));},row);list.append(row);}};
  draw(await window.sllm.roomsMusic(state.token));
  button(L('음악 추가','Add music'),async()=>draw(await window.sllm.roomsMusicAdd(state.token)),controls);
  button(L('재생 / 이어듣기','Play / Resume'),playMusic,controls);
  button(L('일시정지','Pause'),()=>{musicAudio.pause();musicWanted=false;},controls);
  button(L('정지','Stop'),stopMusic,controls);
  for(const [key,label] of [['loop',L('반복','Repeat')],['autoplay',L('입장 시 자동재생','Play on entering')]]){const wrap=el('label','',label),input=el('input');input.type='checkbox';input.checked=musicData.prefs[key];input.onchange=()=>configureMusic({[key]:input.checked}).catch(e=>{input.checked=musicData.prefs[key];note.textContent=e.message;});wrap.prepend(input);controls.append(wrap);}
  const volume=el('input');volume.type='range';volume.min=0;volume.max=1;volume.step=.05;volume.value=musicData.prefs.volume;volume.setAttribute('aria-label',L('음량','Volume'));volume.oninput=()=>musicAudio.volume=Number(volume.value);volume.onchange=()=>configureMusic({volume:Number(volume.value)}).catch(e=>note.textContent=e.message);controls.append(el('label','',L('음량','Volume')),volume);
 }
 const recordCategories=()=>[['all',L('모든 분류','All categories')],['lore',L('세계관','Lore')],['species',L('종족','Species')],['history',L('역사','History')],['writing',L('창작','Writing')]];
 function recordList(kind,preset='all'){
  const d=modal(kind==='journal'?L('개인 일지','Personal journal'):L('독서실 책장','Library shelves'));if(!d)return;
  let items=state.records,archived=false;
  const actions=el('nav'),search=el('input'),category=el('select'),ruler=el('select'),notice=el('p','rooms-note');search.type='search';search.placeholder=L('제목·저자 검색','Search title or author');search.setAttribute('aria-label',search.placeholder);
  category.setAttribute('aria-label',L('분류','Category'));for(const [value,text] of recordCategories()){const o=el('option','',text);o.value=value;category.append(o);}category.value=preset;
  ruler.setAttribute('aria-label',L('원저자','Original author'));
  const authors=()=>{const selected=ruler.value;ruler.replaceChildren();const all=el('option','',L('모든 통치자','All rulers'));all.value='';ruler.append(all);const seen=new Set();for(const r of items.filter(x=>x.kind===kind)){const id=JSON.stringify([r.author?.sid||'?',r.author?.rulerId||'?']);if(seen.has(id))continue;seen.add(id);const o=el('option','',(r.author?.rulerName||L('미확인','Unknown'))+' · '+id);o.value=id;ruler.append(o);}ruler.value=seen.has(selected)?selected:'';};
  actions.append(search,category,ruler);button(L('새 글 쓰기','New writing'),()=>edit(null,kind),actions);
  const archive=button(L('삭제된 기록 보기','Show archived records'),async()=>{try{const r=await window.sllm.roomsArchive(state.token);if(!r.ok)throw Error(r.error);if(dialog!==d)return;items=r.records;archived=!archived;archive.textContent=archived?L('현재 기록 보기','Show active records'):L('삭제된 기록 보기','Show archived records');authors();draw();}catch(e){notice.textContent=e.message;}},actions);
  button(L('파일 가져오기','Import file'),async()=>{try{const r=await window.sllm.roomsImport(state.token,kind);if(!r.ok)throw Error(r.error);if(r.cancelled||dialog!==d)return;await refresh();recordList(kind);}catch(e){notice.textContent=e.message;}},actions);
  button(L('JSON 내보내기','Export JSON'),async()=>{try{const r=await window.sllm.roomsExport(state.token,kind,archived);if(dialog!==d)return;notice.textContent=r.ok?(r.cancelled?'':L('내보냈습니다.','Exported.')):r.error;}catch(e){notice.textContent=e.message;}},actions);
  d.append(actions,notice);const list=el('div','rooms-list');d.append(list);
  const draw=()=>{list.replaceChildren();const q=search.value.toLowerCase();for(const r of items.filter(r=>r.kind===kind&&Boolean(r.deleted)===archived&&(category.value==='all'||r.category===category.value)&&(!ruler.value||JSON.stringify([r.author?.sid||'?',r.author?.rulerId||'?'])===ruler.value)&&(r.title+' '+(r.author?.rulerName||'')).toLowerCase().includes(q)).reverse()){
   const item=el('button','rooms-record');item.append(el('b','',r.title),el('small','',(r.author?.rulerName||L('저자 미확인','Unknown author'))+' · '+(r.author?.date||'')+' · '+(recordCategories().find(x=>x[0]===r.category)?.[1]||'')));
   if(r.imported)item.append(el('small','',L('가져온 자료 · 저자 정보 미검증','Imported · authorship unverified')));
   if(archived){item.onclick=()=>{const preview=el('pre','rooms-note',r.text);preview.style.cssText='white-space:pre-wrap;max-height:220px;overflow:auto';item.after(preview);};const row=el('section');row.append(item);button(L('복원','Restore'),async()=>{try{const result=await window.sllm.roomsRestore(state.token,r.id,r.revision);if(!result.ok)throw Error(result.error);await refresh();if(dialog===d)recordList(kind);}catch(e){notice.textContent=e.message;}},row);list.append(row);}else{item.onclick=()=>read(r,0);list.append(item);}
  }if(!list.children.length)list.append(el('p','',L('조건에 맞는 기록이 없습니다.','No matching records.')));};search.oninput=category.onchange=ruler.onchange=draw;authors();draw();search.focus();
 }
 function edit(record,kind){
  const d=modal(kind==='journal'?L('일지 쓰기','Write a journal entry'):L('책 쓰기','Write a book'));if(!d)return;
  const name=el('input'),body=el('textarea'),notice=el('p','rooms-note');name.maxLength=160;name.placeholder=L('제목','Title');name.setAttribute('aria-label',name.placeholder);name.value=record?.title||'';body.maxLength=kind==='book'?50000:20000;body.placeholder=L('본문','Text');body.setAttribute('aria-label',body.placeholder);body.value=record?.text||'';
  const category=el('select');category.setAttribute('aria-label',L('분류','Category'));for(const [value,text] of recordCategories().slice(1)){const o=el('option','',text);o.value=value;category.append(o);}category.value=record?.category||'writing';
  let summary=null;
  if(kind==='book'){summary=el('textarea','rooms-summary-input');summary.maxLength=1500;summary.rows=3;summary.placeholder=L('짧은 요약문 (선택 · 최대 1,500자)','Short summary (optional · up to 1,500 characters)');summary.setAttribute('aria-label',summary.placeholder);summary.value=record?.aiSummary||'';summary.oninput=()=>{dirty=true;count();};}
  const counter=el('small','rooms-note');const count=()=>{if(summary)counter.textContent=`${Array.from(summary.value).length} / 1500`;};count();
  name.oninput=body.oninput=category.onchange=()=>dirty=true;
  const controls=el('nav');d.append(name,category,body);if(summary)d.append(el('small','rooms-note',L('요약문은 책 정보로만 보관됩니다. 자동으로 AI에게 보내지 않습니다.','The summary is kept as book information only. It is not sent to the AI automatically.')),summary,counter);d.append(notice,controls);
  button(L('저장','Save'),async()=>{
   const token=state.token;const r=await window.sllm.roomsSave(token,{...record,kind,title:name.value,text:body.value,category:category.value,...(summary?{aiSummary:summary.value}:{})});
   if(!root||dialog!==d)return;if(!r.ok){notice.textContent=r.error;return;}dirty=false;
   try{await refresh();read(r.record,0);}catch(e){notice.textContent=e.message;}
  },controls);
  if(record)button(L('삭제','Delete'),async()=>{if(!confirm(L('목록에서 삭제할까요? 보관 사본은 남습니다.','Remove from the list? An archived copy will remain.')))return;const r=await window.sllm.roomsDelete(state.token,record.id,record.revision);if(!r.ok){notice.textContent=r.error;return;}dirty=false;await refresh();recordList(kind);},controls);
  name.focus();
 }
 function read(record,page){
  const d=modal(record.title);if(!d)return;const chars=Array.from(record.text),pages=Math.max(1,Math.ceil(chars.length/640));page=Math.max(0,Math.min(page,pages-1));
  d.classList.add('rooms-reader');const label=el('small','rooms-reading-label',L('함께 읽는 시간','A MOMENT TO READ'));d.querySelector('header strong').prepend(label);const book=el('div','rooms-book');for(let n=0;n<2;n++)book.append(el('article','',chars.slice(page*640+n*320,page*640+(n+1)*320).join('')));
  const provenance=record.imported?L(' · 가져온 자료(저자 정보 미검증)',' · Imported (authorship unverified)'):'';
  const author=el('p','rooms-note',L('저자: ','Author: ')+(record.author?.rulerName||L('미확인','Unknown'))+' · '+(record.author?.date||'')+provenance);
  const controls=el('nav');d.append(book,author,controls);
  if(record.kind==='book'&&record.aiSummary){const box=el('details','rooms-summary');box.append(el('summary','',L('요약문','Summary')),el('p','',record.aiSummary));d.append(box);}
  button('‹',()=>read(record,page-1),controls).disabled=page===0;controls.append(el('span','',`${page+1} / ${pages}`));button('›',()=>read(record,page+1),controls).disabled=page===pages-1;
  button(L('수정','Edit'),()=>edit(record,record.kind),controls);
  const share=button(L('이 페이지를 비서에게 보여주기','Share these pages with your secretary'),async()=>{share.disabled=true;const ref={recordId:record.id,revision:record.revision,page};try{const r=await window.sllm.roomsShare(state.token,{...ref,room,requestId:crypto.randomUUID()});if(!r.ok)throw Error(r.error);if(dialog===d){book.classList.add('shared');chat(ref,d);}}finally{share.disabled=false;}},controls);
  share.disabled=!state.secretary.ready || !(state.secretary.aff>=(record.kind==='journal'?20:10));
 }
 function chat(reference={},parent=root){
  chatPanel?.remove();const panel=chatPanel=el('section','rooms-chat');parent.append(panel);panel.dataset.i18nSkip='';
  const portrait=el('div','rooms-portrait'),face=el('img','rooms-face');portrait.append(face);face.src=base+'library/face-idle.webp';face.alt=state.secretary.name;
  const name=el('strong','',state.secretary.name),log=el('div','rooms-chat-log'),input=el('textarea');input.maxLength=1200;input.placeholder=L('비서에게 이야기하세요.','Talk to your secretary.');input.setAttribute('aria-label',input.placeholder);log.dataset.empty=L('마음에 남는 구절을 비서와 나눠 보세요.','Share a passage or a thought with your secretary.');const actions=el('nav');panel.append(portrait,name,log,input,actions);
  button(L('대화 마치기','End conversation'),()=>{parent.querySelector('.rooms-book')?.classList.remove('shared');panel.remove();if(chatPanel===panel)chatPanel=null;},actions);
  const send=button(L('보내기','Send'),async()=>{
   const text=input.value.trim();if(!text)return;send.disabled=true;const ticket=seq,token=state.token;
   try{const r=await window.sllm.roomsChat(token,{room,text,requestId:crypto.randomUUID(),...reference});if(!root||ticket!==seq||!panel.isConnected)return;
    if(!r.ok){log.append(el('p','rooms-error',r.error));return;}
    log.append(el('p','rooms-user-line',state.actor.rulerName+' · '+text),el('p','',r.name+' · '+r.reply));if(r.warning)log.append(el('p','rooms-error',r.warning));input.value='';log.scrollTop=log.scrollHeight;
    face.src=base+'library/face-'+(['smile','think'].includes(r.pose)?r.pose:'idle')+'.webp';
   }catch(e){if(panel.isConnected)log.append(el('p','rooms-error',e.message));}finally{send.disabled=false;}
  },actions);input.focus();
 }
 async function open(){
  if(root||opening)return;opening=true;state=null;
  try{await window.sllm.officeBack();await refresh();style=await window.sllm.officeStyle();}catch(e){alert(e.message);return;}finally{opening=false;}
  root=el('section','private-rooms');root.dataset.i18nSkip='';root.setAttribute('role','dialog');root.setAttribute('aria-label',L('집무실 공간','Office rooms'));
  const header=el('header');title=el('strong');header.append(title);button('×',close,header).setAttribute('aria-label',L('집무실로 돌아가기','Return to office'));
  const frame=el('main','rooms-frame');stage=el('div','rooms-stage');frame.append(stage);toolbar=el('nav','rooms-toolbar');status=el('p','rooms-status');status.setAttribute('role','status');root.append(header,frame,toolbar,status);document.body.append(root);go('corridor');
 }
 document.addEventListener('DOMContentLoaded',()=>{
  const anchor=document.getElementById('secCall');if(!anchor)return;
  const call=el('button','ic');call.id='roomsCall';call.innerHTML='<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 40V8h32v32M17 40V14h14v26M24 28h3"/></svg>';call.append(el('span','',L('복도로 나가기','Enter corridor')));call.onclick=open;anchor.after(call);
  window.addEventListener('keydown',e=>{if(root&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();if(dialog)closeDialog();else if(room!=='corridor')go('corridor');else close();}},true);
  window.sllm.onOfficeState?.(s=>{if(root&&s.sid!==state?.actor.sid){stopTV();seq++;chatPanel?.remove();chatPanel=null;stage.querySelectorAll('.rooms-sofa-companion,.rooms-sofa-front').forEach(x=>x.remove());void window.sllm.roomsCompanion(state.token,'leave').catch(()=>{});musicAudio.pause();musicWanted=false;message(L('세이브가 바뀌었습니다. 작성 중인 내용은 복사한 뒤 방을 다시 열어 주세요.','The save changed. Copy any unsaved writing, then reopen the room.'));}});
  document.addEventListener('sllm-language',()=>{call.querySelector('span').textContent=L('복도로 나가기','Enter corridor');if(root&&!dirty)close();});
 });
 window.SLLMPrivateRooms={open,close};
})();
