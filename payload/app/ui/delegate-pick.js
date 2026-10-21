// 의회 의원 초상화 고르기(순수 함수). 포트레이트 라이브러리 항목에서 의석마다 시드 기반 랜덤으로 뽑는다.
// - 옷은 통일(governor → ruler → 기본 순서로 있는 것), 성별은 남/여가 섞이게 가중치를 맞춘다.
// - 외계인 혐오 제국은 통치자의 모델 하나(남/여 쌍 포함)만 쓴다. 통치자에게 맞는 라이브러리 항목(item)을 알면 그 모델, 모르면 제국 이름으로 고정한 한 모델.
(function (root) {
  const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = (seed) => { let a = hash(seed); return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const genderOf = (id) => /(^|_)female(_|$)|_f(_|$)/.test(id) ? 'f' : /(^|_)male(_|$)|_m(_|$)/.test(id) ? 'm' : '';
  const familyKey = (id) => id.replace(/(^|_)(female|male)(?=_|$)/, '$1#').replace(/_[fm](?=_|$)/, '_#');
  const ROLE_PREF = ['governor', 'ruler'];
  const urlOf = (it) => { for (const r of ROLE_PREF) if (it.roles[r]) return it.roles[r]; return it.roles[it.defaultRole] || Object.values(it.roles)[0] || null; };
  function pick(items, cls, seed, o) {
    o = o || {};
    items = items || [];
    let pool = items.filter((it) => it.cls === cls);
    if (o.xeno) { // 외계인 혐오: 의석의 종족 계열과 상관없이 통치자의 모델(남/여 쌍)만 쓴다
      let fam = [];
      if (o.item || o.portrait) { const base = o.item ? items.find((it) => it.id === o.item) : items.find((it) => (it.portraits || []).includes(o.portrait)); if (base) { const k = familyKey(base.id); fam = items.filter((it) => familyKey(it.id) === k); } }
      if (!fam.length && pool.length) { const keys = [...new Set(pool.map((it) => familyKey(it.id)))].sort(); const k = keys[hash('xeno|' + (o.empire || '')) % keys.length]; fam = pool.filter((it) => familyKey(it.id) === k); }
      if (fam.length) pool = fam;
    }
    if (!pool.length) return null;
    const n = { f: 0, m: 0 }; pool.forEach((it) => { const g = genderOf(it.id); if (g) n[g]++; });
    const top = Math.max(n.f, n.m);
    const w = pool.map((it) => { const g = genderOf(it.id); return g && n[g] ? top / n[g] : 1; });
    let r = rng(seed)() * w.reduce((a, b) => a + b, 0), i = 0;
    for (; i < pool.length - 1; i++) { r -= w[i]; if (r < 0) break; }
    return { id: pool[i].id, url: urlOf(pool[i]) };
  }
  const api = { pick, genderOf, familyKey, hash };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SLLMDelegate = api;
})(typeof window !== 'undefined' ? window : globalThis);
