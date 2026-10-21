"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MailPlan = exports.cmpDate = exports.addYears = exports.MAJOR_WORLD = exports.RAW_NAME_KEY = exports.LETTER_ACTIONS = void 0;
exports.mailCountryFrom = mailCountryFrom;
exports.newsFrom = newsFrom;
exports.newsText = newsText;
exports.involves = involves;
exports.monthOf = monthOf;
exports.pickMessages = pickMessages;
exports.parsePick = parsePick;
exports.letterMessages = letterMessages;
exports.treatyLetterMessages = treatyLetterMessages;
const prompt_1 = require("./prompt");
const i18n_pick_1 = require("./i18n-pick");
const transcript_1 = require("./transcript");
const FLAG_KEYS = ['war', 'truce', 'rival', 'hostile', 'unfriendly', 'friendly', 'fed', 'nap', 'def'];
// 편지에 붙일 수 있는 제안(선전포고·평화는 편지로 하지 않는다)
exports.LETTER_ACTIONS = new Set(['give_energy', 'take_energy', 'open_borders']);
/** SLLM:MAILC 줄 → 제국 정보. 관계 플래그는 플레이어를 향한 것. */
function mailCountryFrom(m) {
    if (m.kind !== 'MAILC')
        return null;
    const idx = Number(m.kv.idx);
    if (!Number.isFinite(idx) || idx <= 0)
        return null;
    const g = (k) => (m.kv[k] ?? '').trim();
    const flags = {};
    for (const k of FLAG_KEYS)
        flags[k] = Number(m.kv[k]) > 0;
    const op = Number(m.kv.op);
    return {
        idx, name: g('name'), op: Number.isFinite(op) ? Math.round(op) : 0,
        profile: { gov: g('gov'), species: g('species'), personality: g('personality'), origin: g('origin'), ruler: g('ruler'), title: g('title'), home: g('home'), att: 0, organ: g('organ'), adj: g('adj'), flags, cls: Number(m.kv.cls) || 0 },
    };
}
/** 게임이 이름 대신 번역 키(NAME_dead_leader_country 같은 것)를 그대로 보낸 나라: 해적·이미 사라진 나라 같은 게임 내부 나라라 사건으로 다루지 않는다(2026-10-19 호외에 키가 그대로 나온 문제). */
exports.RAW_NAME_KEY = /(^|\s)NAME_[A-Za-z0-9_]+/;
/** SLLM:NEWS 줄 → 사건. */
function newsFrom(m) {
    if (m.kind !== 'NEWS' || !m.kv.kind)
        return null;
    const num = (k) => { const n = Number(m.kv[k]); return Number.isFinite(n) && n > 0 ? n : undefined; };
    const g = (k) => (m.kv[k] ?? '').trim() || undefined;
    const n = { kind: m.kv.kind, date: g('date') ?? '', a: num('a'), aname: g('aname'), b: num('b'), bname: g('bname'), war: g('war'), ruler: g('ruler') };
    if (exports.RAW_NAME_KEY.test(n.aname ?? '') || exports.RAW_NAME_KEY.test(n.bname ?? ''))
        return null;
    // 현상 유지는 게임이 양쪽에서 한 번씩 부를 수 있다 → 두 나라 순서를 이름순으로 맞춰 같은 사건으로 만든다(2026-10-18)
    if (n.kind === 'war_sq' && (n.aname ?? '') > (n.bname ?? '')) {
        [n.a, n.b] = [n.b, n.a];
        [n.aname, n.bname] = [n.bname, n.aname];
    }
    return n;
}
/** AI 끼리의 일 중 연대기와 신문에 남길 큰 사건인가(전쟁·연방·연합·협정·위기·멸망·조공국화). 플레이어가 낀 일은 이 기준과 상관없이 늘 남긴다. */
exports.MAJOR_WORLD = new Set(['war', 'war_end', 'war_sq', 'fed_join', 'fed_leave', 'ally_join', 'ally_leave', 'pact_com', 'pact_def', 'destroyed', 'subject', 'crisis']);
/** 사건을 한 문장으로(기록 당시 인터페이스 언어 — 연대기·호외에 그대로 쌓이고 AI 에게도 간다, 2026-10-19). */
function newsText(n) {
    const a = n.aname ?? (0, i18n_pick_1.L)('어느 제국', 'an empire'), b = n.bname ?? (0, i18n_pick_1.L)('어느 제국', 'an empire');
    switch (n.kind) {
        case 'war': return (0, i18n_pick_1.L)(`전쟁 "${n.war ?? '?'}": ${a}이(가) 참전했다`, `War "${n.war ?? '?'}": ${a} joined`); // 앞머리를 전쟁 이름으로 두어 참전국들을 한 사건으로 묶을 수 있게 한다(galnews.mergeWarFacts)
        case 'war_end': return (0, i18n_pick_1.L)(`${a}과(와) ${b}의 전쟁이 끝났다(승패 미확인 — 현상 유지 강화일 수도 있다)`, `The war between ${a} and ${b} ended (outcome unknown - possibly a status quo peace)`); // on_war_ended 는 백지평화에도 불린다(2026-10-18)
        case 'war_sq': return (0, i18n_pick_1.L)(`${a}과(와) ${b}이(가) 현상 유지 강화로 전쟁을 끝냈다(승패 없음)`, `${a} and ${b} ended their war with a status quo peace (no winner)`);
        case 'ruler': return (0, i18n_pick_1.L)(`${a}에 새 지도자 ${n.ruler ?? '?'}이(가) 올랐다`, `${a} has a new leader, ${n.ruler ?? '?'}`);
        case 'fed_join': return (0, i18n_pick_1.L)(`${a}이(가) ${b}이(가) 이끄는 연방에 가입했다`, `${a} joined the federation led by ${b}`);
        case 'fed_leave': return (0, i18n_pick_1.L)(`${a}이(가) ${b}이(가) 이끄는 연방을 떠났다`, `${a} left the federation led by ${b}`);
        case 'pact_com': return (0, i18n_pick_1.L)(`${a}과(와) ${b}이(가) 통상 협정을 맺었다`, `${a} and ${b} signed a commercial pact`);
        case 'pact_def': return (0, i18n_pick_1.L)(`${a}과(와) ${b}이(가) 방위 협정을 맺었다`, `${a} and ${b} signed a defensive pact`);
        case 'ally_join': return (0, i18n_pick_1.L)(`${a}과(와) ${b}이(가) 연합(동맹)을 맺었다`, `${a} and ${b} formed an alliance`);
        case 'ally_leave': return (0, i18n_pick_1.L)(`${a}과(와) ${b}의 연합(동맹)이 깨졌다`, `The alliance between ${a} and ${b} broke up`);
        case 'destroyed': return (0, i18n_pick_1.L)(`${a}이(가) 멸망했다${n.bname ? '(' + b + '에 의해)' : ''}`, `${a} was destroyed${n.bname ? ' (by ' + b + ')' : ''}`);
        case 'subject': return (0, i18n_pick_1.L)(`${a}이(가) ${b}의 조공국(속국)이 되었다`, `${a} became a subject of ${b}`);
        case 'crisis': return (0, i18n_pick_1.L)(`${a}: 은하 위기가 시작되었다`, `${a}: a galactic crisis has begun`);
        default: return `${a}: ${n.kind}`;
    }
}
/** 이 제국과 관련된 사건인가(번호 또는 이름으로). */
function involves(n, c) {
    return n.a === c.idx || n.b === c.idx || n.aname === c.name || n.bname === c.name;
}
// F-28: 날짜 계산은 gamedate.ts 한 곳에(옛 이름은 그대로 내보냄)
var gamedate_1 = require("./gamedate");
Object.defineProperty(exports, "addYears", { enumerable: true, get: function () { return gamedate_1.addYears; } });
Object.defineProperty(exports, "cmpDate", { enumerable: true, get: function () { return gamedate_1.cmpDate; } });
function monthOf(date) {
    const m = /^\d+\.(\d+)\./.exec(date.trim());
    return m ? Number(m[1]) : 0;
}
/** 1단계: 올해 편지를 쓸 제국 고르기(한 번의 호출). */
function pickMessages(player, date, countries, news, paper) {
    const rows = countries.map((c) => {
        const ctx = { idx: c.idx, name: c.name, player, opinionA: 0, opinionB: c.op, score: c.op, profile: c.profile };
        const rel = Object.entries(c.profile.flags).filter(([, v]) => v).map(([k]) => k).join(',') || 'none';
        const ev = news.filter((n) => involves(n, c)).map(newsText);
        return `- id ${c.idx}: ${c.name} / personality ${c.profile.personality || '?'} / government ${c.profile.gov || '?'} / attitude toward the player ${(0, prompt_1.stance)(ctx)} (score ${c.op}) / relations ${rel} / related events this year: ${ev.length ? ev.join('; ') : 'none'}`;
    });
    const sys = [
        'You are the diplomatic editor of a space strategy game. Decide whether each AI empire has a reason to send the player empire a diplomatic letter this year on its own initiative.',
        'Pick only empires with a clear reason: their relations changed, a related event happened, or their personality gives them something to say. If they have nothing to say, do not pick them. If nobody qualifies, return an empty list.',
        'Answer with exactly one JSON: {"writers":[{"idx":id number,"why":"one sentence: why they write"}]}',
    ].join('\n');
    const user = `Date: ${date}\nPlayer empire: ${player}\nEmpires:\n${rows.join('\n')}\n\nAll events:\n${news.map((n) => '- ' + n.date + ' ' + newsText(n)).join('\n') || '- none'}` + (paper && paper.length ? `\n\nRecent galactic news (read by every empire; an empire named in an article, or one sensitive to it, may have a reason to write):\n${paper.join('\n')}` : '');
    return [{ role: 'system', content: sys }, { role: 'user', content: user }];
}
/** 고르기 답을 해석한다. 목록에 없는 번호는 버리고, 도착 달을 1~12 중에서 흩는다. */
function parsePick(raw, allowed, rand = Math.random) {
    let obj = null;
    try {
        obj = JSON.parse(raw);
    }
    catch {
        const m = /\{[\s\S]*\}/.exec(raw);
        if (m) {
            try {
                obj = JSON.parse(m[0]);
            }
            catch {
                obj = null;
            }
        }
    }
    const list = Array.isArray(obj?.writers) ? obj.writers : [];
    const seen = new Set();
    const out = [];
    for (const w of list) {
        const idx = Number(w?.idx);
        if (!allowed.includes(idx) || seen.has(idx))
            continue;
        seen.add(idx);
        out.push({ idx, why: String(w?.why ?? '').slice(0, 200), month: 1 + Math.floor(rand() * 12) });
    }
    return out;
}
/** 2단계: 한 제국의 편지 쓰기. 같은 대화 형식(JSON)을 쓰고, 이번만 편지 길이로 쓰게 한다. */
function letterMessages(player, date, c, why, news, paper) {
    const ctx = { idx: c.idx, name: c.name, player, opinionA: 0, opinionB: c.op, score: c.op, profile: c.profile, ...(paper && paper.length ? { galnews: paper } : {}) };
    const ev = news.filter((n) => involves(n, c)).map((n) => '- ' + n.date + ' ' + newsText(n));
    const user = [
        `${transcript_1.SYSTEM_PREFIX}It is now ${date}. This time they did not speak to you; you are sending ${player} a diplomatic letter first.`,
        `Why you write: ${why || 'you have something to say given your personality and relations'}`,
        ev.length ? `Recent related news:\n${ev.join('\n')}` : 'Recent related news: none',
        'For this reply only, write say as a 3-6 sentence letter instead of the two-sentence limit. Open with a short greeting and sign off with your title and name.',
        'Leave mood as none. Do not declare war or propose peace by letter. Use one of give_energy, take_energy or open_borders as the action only when an offer feels natural.',
    ].join('\n');
    return [{ role: 'system', content: (0, prompt_1.systemPrompt)(ctx) }, { role: 'user', content: user }];
}
/** 조약 얼버무리기의 서신: 대화에서 "의원들과 논의해 서신으로 알리겠다"고 한 일의 결과를, 그때의 속마음(lean)대로 알린다. */
function treatyLetterMessages(player, date, c, topic, lean, news) {
    const ctx = { idx: c.idx, name: c.name, player, opinionA: 0, opinionB: c.op, score: c.op, profile: c.profile };
    const ev = news.filter((n) => involves(n, c)).map((n) => '- ' + n.date + ' ' + newsText(n));
    const verdict = lean === 'positive'
        ? 'The conclusion is favorable. Say you discussed it with your councilors and looked on it kindly, but make clear this letter does not conclude the treaty and that a formal proposal should be sent through the diplomacy window.'
        : lean === 'negative'
            ? 'The conclusion is unfavorable. In keeping with your personality (politely or coldly), say you cannot accept it now. Do not invent new facts or reasons; base it on your relations and personality.'
            : 'You have not reached a conclusion yet. Say you discussed it but will watch a while longer. Do not invent specific conditions or facts.';
    const user = [
        `${transcript_1.SYSTEM_PREFIX}It is now ${date}. Earlier, when ${player} asked for "${topic}", you promised to discuss it with your councilors and answer by letter. Now you write that letter.`,
        verdict,
        ev.length ? `Recent related news:\n${ev.join('\n')}` : 'Recent related news: none',
        'For this reply only, write say as a 3-6 sentence letter instead of the two-sentence limit. Open with a short greeting and sign off with your title and name.',
        'Leave mood as none and action as {"type":"none"}. Do not write that the treaty has already been concluded.',
    ].join('\n');
    return [{ role: 'system', content: (0, prompt_1.systemPrompt)(ctx) }, { role: 'user', content: user }];
}
/** 올해의 편지 일정. MONTH 신호마다 그 달에 도착할 편지를 꺼낸다. */
class MailPlan {
    writers = [];
    year = '';
    set(yearDate, writers) { this.year = yearDate; this.writers = writers.slice(); }
    /** date 의 달이 된(또는 지난) 편지를 꺼낸다. 해가 바뀌었으면 남은 것을 모두 꺼낸다. */
    due(date) {
        if (!this.writers.length)
            return [];
        const sameYear = this.year && date.split('.')[0] === this.year.split('.')[0];
        const mon = monthOf(date);
        const now = this.writers.filter((w) => !sameYear || w.month <= mon);
        this.writers = this.writers.filter((w) => !now.includes(w));
        return now;
    }
    /** 실시간 타이머용: 순서와 상관없이 가장 먼저 잡힌 편지 하나. */
    takeOne() { return this.writers.shift() ?? null; }
    get size() { return this.writers.length; }
}
exports.MailPlan = MailPlan;
//# sourceMappingURL=mail.js.map