/* Artwork-only renderer. Feed the same {applied, emblemUrl} used by office-style.js.
 * Does not read saves, invoke AI, change game state or invent an empire emblem.
 */
(() => {
  const themes = [
    ['authoritarian','권위주의','Authoritarian',[[19.5,12,2.2,8,12],[29.5,24,1.1,6,8],[34.7,27,2.1,8,0],[65,27,2.1,8,0],[70.4,24,1.1,6,-8],[80.5,12,2.2,8,-12]]],
    ['egalitarian','평등주의','Egalitarian',[[19.5,21,1.8,8,12],[80.5,21,1.8,8,-12]]],
    ['xenophile','외계종 선호','Xenophile',[]],
    ['xenophobe','외계종 혐오','Xenophobe',[[22.1,10,1.5,7,12],[30.4,23,1,6,8],[34.7,27,1.8,8,0],[64.8,27,1.8,8,0],[69,23,1,6,-8],[78.3,10,1.5,7,-12]]],
    ['militarist','군국주의','Militarist',[[34.6,23,1.8,7,0],[65,23,1.8,7,0]]],
    ['pacifist','평화주의','Pacifist',[]],
    ['spiritualist','정신주의','Spiritualist',[[18.5,15,1.8,7,12],[32,27,.8,5,8],[38,28,1.5,7,0],[62,28,1.5,7,0],[68,27,.8,5,-8],[81.5,15,1.8,7,-12]]],
    ['materialist','물질주의','Materialist',[]],
  ];
  // Conservative data-image allowlist. Host should use its trusted local asset protocol.
  function safeImage(url) {
    if (typeof url !== 'string' || url.length > 12000000 || /["'\\\n\r<>]/.test(url)) return false;
    if (/^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(url)) return true;
    if (/^blob:/.test(url)) return true;
    if (/^(file:|sllm-asset:|app:)/.test(url)) return true;
    return /^[a-zA-Z0-9_./-]+\.(png|webp|jpg|jpeg)$/.test(url) && !url.includes('..');
  }
  function mount(root, { assetBase = 'assets', pick = (ko) => ko, onRoom = () => {} } = {}) {
    root.classList.add('corridor-scene');
    const art = document.createElement('img'); art.className = 'corridor-background'; art.alt = '';
    const emblems = document.createElement('div'); emblems.className = 'corridor-emblems'; emblems.setAttribute('aria-hidden','true');
    const rooms = [['exhibition','전시실','Exhibition room'],['private','통치자 개인실','Ruler’s private room'],['office','집무실','Executive office'],['secretary','비서실','Secretary’s office'],['reading','독서실','Reading room']];
    const buttons = rooms.map(([id,ko,en],i) => {
      const b = document.createElement('button'); b.type='button'; b.className='corridor-door door-'+i;
      b.setAttribute('aria-label',pick(ko,en)+' · '+pick('열기','Open'));
      const tip=document.createElement('span'); tip.textContent=pick(ko,en)+' · '+pick('열기','Open'); b.append(tip);
      b.onclick=()=>onRoom(id); return b;
    });
    root.replaceChildren(art,emblems,...buttons);
    let alive=true, seq=0;
    async function update(state) {
      const theme=themes.find(t=>t[0]===state?.applied) || themes[0];
      const ticket=++seq, url=state?.emblemUrl;
      root.dataset.style=theme[0]; art.src=assetBase+'/corridor-'+theme[0]+'.webp';
      emblems.replaceChildren();
      if(!safeImage(url)) return;
      const probe=new Image(); probe.src=url;
      try { await probe.decode(); } catch { return; }
      if(!alive || ticket!==seq || !probe.naturalWidth) return;
      for(const [x,y,w,h,skew] of theme[3]) {
        const mark=document.createElement('i'); mark.className='corridor-emblem';
        Object.assign(mark.style,{left:x+'%',top:y+'%',width:w+'%',height:h+'%',transform:`translateX(-50%) skewY(${skew}deg)`});
        mark.style.setProperty('--emblem',`url("${url}")`); emblems.append(mark);
      }
    }
    return {update, destroy(){alive=false;seq++;root.replaceChildren();root.classList.remove('corridor-scene');}};
  }
  window.SLLMCorridorArt={mount,themes};
})();
