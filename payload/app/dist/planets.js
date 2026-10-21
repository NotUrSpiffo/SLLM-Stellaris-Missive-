"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planetTypeEn = exports.planetType = exports.PC_KO = exports.PlanetCollector = exports.DEFAULT_GOVERNOR = void 0;
exports.cleanPlanetClassName = cleanPlanetClassName;
exports.governorName = governorName;
exports.className = className;
exports.classNameEn = classNameEn;
exports.planetFacts = planetFacts;
exports.govPrompt = govPrompt;
exports.govMessages = govMessages;
exports.extractGovSay = extractGovSay;
exports.govLooksCut = govLooksCut;
const speciesClass_1 = require("./speciesClass");
const govmemory_1 = require("./govmemory");
exports.DEFAULT_GOVERNOR = '일반 총독관';
const num = (v, none) => { if (!v?.trim())
    return null; const n = Number(v); return Number.isFinite(n) && n !== none ? n : null; };
/** 정확한 주민 수(pn)가 있으면 그것을, 없으면 단계 값(pops, 'N 이상')을 쓴다. */
const popsOf = (pn, step) => {
    const exact = num(pn, -1), lo = num(step, -1);
    // 4.x 에서 옛 모드의 num_pops 는 늘 0 을 보낸다(2026-10-18 제보: 총독 화면 주민 0). 단계 값이 1 이상인데 정확한 수가 0 이면 정확한 수를 믿지 않는다.
    if (exact !== null && exact >= 0 && !(exact === 0 && lo !== null && lo > 0))
        return { pops: Math.round(exact) };
    return lo === null ? { pops: null } : { pops: lo, popsApprox: true };
};
function cleanPlanetClassName(value) {
    if (typeof value !== 'string')
        return '';
    const text = value.replace(/[\u0000-\u001f]/g, ' ').trim();
    return !text || /[\[\]$]/.test(text) ? '' : text.slice(0, 120);
}
/** 게임 로그 줄을 받아 행성 목록을 모은다. 목록이 끝나면(PLANETS_END) 완성된 목록을 돌려준다. */
class PlanetCollector {
    cur = null;
    feed(m) {
        if (m.kind === 'PLANETS') {
            this.cur = { run: Number(m.kv.run) || 0, sid: (m.kv.sid ?? '').trim(), cls: Number(m.kv.cls) || 0, empire: (m.kv.empire ?? '').trim(), planets: [] };
        }
        else if (m.kind === 'PLANET' && this.cur) {
            const name = (m.kv.name ?? '').trim();
            const className = cleanPlanetClassName(m.kv.class);
            if (name)
                this.cur.planets.push({ name, ...popsOf(m.kv.pn, m.kv.pops), stability: num(m.kv.stab, -999), amenities: scale100(num(m.kv.amen, -999)), housing: scale100(num(m.kv.hous, -999)), capital: m.kv.cap === '1', pc: Number(m.kv.pc) || 0, governor: null, ...(className ? { className } : {}) });
        }
        else if (m.kind === 'GOV' && this.cur && this.cur.planets.length) {
            const g = (m.kv.name ?? '').trim();
            if (g)
                this.cur.planets[this.cur.planets.length - 1].governor = g;
        }
        else if (m.kind === 'PLANETS_END' && this.cur) {
            const done = this.cur;
            this.cur = null;
            return done;
        }
        return null;
    }
}
exports.PlanetCollector = PlanetCollector;
exports.PC_KO = ['', '사막 행성', '초원 행성', '대륙 행성', '열대 행성', '해양 행성', '북극·빙설 행성', '고산 행성', '불모의 행성', '핵폐허 행성', '용암 행성', '독성 행성', '가스 거인', '소행성', '기계·도시 행성', '고리 세계', '서식지', '장막에 싸인 행성', '군집 행성', '건조 행성', '가이아 행성', '툰드라 행성'];
const planetType = (p) => cleanPlanetClassName(p.className) || exports.PC_KO[p.pc] || '';
exports.planetType = planetType;
/** AI 프롬프트용 행성 종류(영어, 2026-10-19 프롬프트 영어화). 게임이 준 이름(게임 언어)이 있으면 그대로. */
const PC_EN = ['', 'desert world', 'savanna world', 'continental world', 'tropical world', 'ocean world', 'arctic world', 'alpine world', 'barren world', 'tomb world', 'molten world', 'toxic world', 'gas giant', 'asteroid', 'machine/ecumenopolis world', 'ring world', 'habitat', 'shrouded world', 'hive world', 'arid world', 'gaia world', 'tundra world'];
const planetTypeEn = (p) => cleanPlanetClassName(p.className) || PC_EN[p.pc] || '';
exports.planetTypeEn = planetTypeEn;
/** 총독의 이름. 총독이 있으면 그 이름, 없으면 일반 총독관. */
/** 편의/주거는 게임이 값을 100배로 내보낸다(6581 = 65.81). -999(못 읽음)는 그대로. */
function scale100(v) { return v === null ? null : v / 100; }
function governorName(p) { return p.governor && p.governor.trim() ? p.governor.trim() : exports.DEFAULT_GOVERNOR; }
const CLASS_KO = {
    human: '인간형',
    mammalian: '포유류',
    reptilian: '파충류',
    avian: '조류',
    arthropoid: '절지류',
    molluscoid: '연체류',
    fungoid: '균류',
    plantoid: '식물류',
    infernal: '지옥형',
    lithoid: '암석형',
    necroid: '사령형',
    aquatic: '수생',
    toxoid: '독성형',
    robot: '로봇',
    machine: '기계',
    cybernetic: '사이버네틱',
};
function className(cls) { const k = (0, speciesClass_1.classKey)(cls); return k ? (CLASS_KO[k] ?? '') : ''; }
/** AI 프롬프트용 종족 계열(영어). */
function classNameEn(cls) { const k = (0, speciesClass_1.classKey)(cls); return k ?? ''; }
/** 행성의 현재 상태를 한 문단의 사실로. 읽지 못한 값은 적지 않는다(지어내지 않게). */
function planetFacts(p) {
    const f = [];
    if (p.capital)
        f.push('it is the empire\'s capital world');
    if (p.pops !== null)
        f.push(p.popsApprox ? `population at least ${p.pops} (exact count unknown: only say it is large, never invent a number)` : `population ${p.pops}`);
    if (p.stability !== null)
        f.push(`stability ${Math.round(p.stability)}` + (p.stability < 25 ? ' (low)' : p.stability >= 75 ? ' (high)' : ''));
    if (p.amenities !== null)
        f.push(p.amenities < 0 ? `amenities short by ${Math.round(-p.amenities)}` : `amenities surplus of ${Math.round(p.amenities)}`);
    if (p.housing !== null)
        f.push(p.housing < 0 ? `housing short by ${Math.round(-p.housing)}` : `housing surplus of ${Math.round(p.housing)}`);
    return f.length ? f.join(', ') + '.' : '(no figures could be read)';
}
/** mem: 이름 있는 총독이고 기억 기능을 쓸 때만 넘긴다(일반 총독관은 undefined). 프롬프트는 영어(답 언어는 AI 라우터가 정함, 2026-10-19). */
function govPrompt(list, p, player, mem, other) {
    const gov = governorName(p), real = gov !== exports.DEFAULT_GOVERNOR, cn = classNameEn(list.cls), pt = (0, exports.planetTypeEn)(p);
    const lines = [
        `You are ${real ? `Governor ${gov}` : 'the standard governing administrator'} of the planet "${p.name}" in the empire "${list.empire || 'the empire'}". The empire's leader "${player || 'the player'}" is talking with you now.`,
        `Current state of this planet (background you know): ${planetFacts(p)}`,
    ];
    if (pt)
        lines.push(`This planet is a ${pt}. You may add a very brief remark about its scenery or climate, but do not invent details its planet type does not imply.`);
    if (cn)
        lines.push(`You belong to a ${cn} species. You may very occasionally let species traits show in how you speak, but do not overdo it.`);
    lines.push('Most important rule: do not volunteer status reports or advice until the leader directly asks about the planet\'s state, situation, problems or advice. Answer greetings, small talk, personal questions and other topics naturally without a report. Do not habitually tack the planet\'s situation onto the end of your lines.');
    lines.push('Only when the leader asks about the state or for advice, answer from the state above: point out the problems the figures show (stability, amenities, housing) and suggest what could be done. Do not invent specific figures not listed above, such as buildings, resource output or population makeup. Say you do not know what you do not know.');
    lines.push('You only report and advise; you do not change the game state yourself. Never say or promise that you built or redesignated anything. The leader decides.');
    lines.push(real ? 'Speak realistically, like a field chief who has served on this planet for a long time.' : 'Speak like a calm, diligent bureaucrat.');
    if (mem) {
        lines.push((0, govmemory_1.memoryPrompt)(mem, other));
        lines.push('Answer in two or three sentences at most, always as this planet\'s governor. Do not talk about anything outside the game. Answer only in the JSON format above.');
    }
    else
        lines.push('Answer in two or three sentences at most, always as this planet\'s governor. Do not talk about anything outside the game. Write only the spoken line, with no JSON or explanation.');
    return lines.join('\n');
}
function govMessages(list, p, player, history, userText, mem, other) {
    return [{ role: 'system', content: govPrompt(list, p, player, mem, other) }, ...history.slice(-8), { role: 'user', content: userText }];
}
/** 총독 답변에서 대사를 뽑는다. JSON 이 끊기거나 깨져도 "say" 값만 건진다. */
function extractGovSay(raw) {
    let t = raw.trim().replace(/^```[a-z]*\s*|\s*```$/g, '').trim();
    if (!t.startsWith('{'))
        return { say: t, memo: '' };
    try {
        const j = JSON.parse(t);
        if (typeof j.say === 'string')
            return { say: j.say.trim(), memo: typeof j.memo === 'string' ? j.memo : '' };
    }
    catch { /* 아래에서 직접 뽑는다 */ }
    const st = /"say"\s*:\s*"/.exec(t);
    if (!st)
        return { say: t.replace(/^\{\s*/, ''), memo: '' };
    // 모델이 대사 안에 따옴표를 이스케이프 없이 쓰는 경우가 있어, 닫는 따옴표를 "memo" 앞/문장 끝에서 찾는다.
    let body = t.slice(st.index + st[0].length);
    const e1 = body.search(/"\s*,\s*"memo"/);
    if (e1 >= 0)
        body = body.slice(0, e1);
    else
        body = body.replace(/"?\s*\}?\s*$/, '');
    let say = body;
    try {
        say = JSON.parse('"' + body.replace(/\\$/, '').replace(/(?<!\\)"/g, '\\"') + '"');
    }
    catch { /* 그대로 */ }
    const mm = /"memo"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(t);
    return { say: say.trim(), memo: mm ? mm[1] : '' };
}
/** 답이 중간에 끊겼는가: 토큰 한도 표시가 있거나, JSON 으로 시작했는데 닫히지 않았다. */
function govLooksCut(raw) {
    const t = raw.trim().replace(/^```[a-z]*\s*|\s*```$/g, '').trim();
    if (t.includes('…(잘림)') || t.includes('…(cut off)'))
        return true; // player2.ts 끊김 표시(화면 언어에 따라 한/영)
    return t.startsWith('{') && !t.endsWith('}');
}
//# sourceMappingURL=planets.js.map