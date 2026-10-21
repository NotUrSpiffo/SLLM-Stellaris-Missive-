// 내장 브랜드와 사용자 그림. 열린 신문·라디오에도 변경을 반영한다.
window.MediaBrands = (() => {
 const families = { stn: { paper: '성간일보', radio: '성간방송 STN' }, starcluster: { paper: '별무리 속보', radio: '별무리 라디오' }, void: { paper: '공허 통신', radio: '공허 공영방송' } };
 let prefs = []; const tracked = new Map();
 function draw(img, key, kind) {
   const pref = prefs.find((p) => p.id === key), fallback = 'brands/' + key + '-' + kind + '.svg';
   const src = pref && pref[kind === 'paper' ? 'paperImage' : 'radioImage'];
   img.onerror = () => { img.onerror = null; img.src = fallback; };
   img.src = src || fallback; img.style.objectFit = 'contain';
   const name = (pref && pref[kind === 'paper' ? 'name' : 'radio']) || families[key][kind];
   img.alt = name + ' 브랜드'; img.title = name;
 }
 function apply(img, family, kind) {
   const key = Object.prototype.hasOwnProperty.call(families, family) ? family : 'stn';
   for (const [old] of tracked) if (!old.isConnected && old !== img) tracked.delete(old);
   tracked.set(img, { key, kind }); draw(img, key, kind);
 }
 function refresh(state) { prefs = state; for (const [img, v] of tracked) { if (img.isConnected) draw(img, v.key, v.kind); else tracked.delete(img); } }
 if (window.sllm?.mediaGet) { window.sllm.mediaGet().then(refresh).catch(() => {}); window.sllm.onMediaChanged(refresh); }
 return {
   paper(img, index) { apply(img, Object.keys(families)[index] || 'stn', 'paper'); },
   radio(img, id) { apply(img, id, 'radio'); }
 };
})();
