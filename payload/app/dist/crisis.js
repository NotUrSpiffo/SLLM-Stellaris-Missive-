"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crisisEndText = exports.crisisBeginText = exports.crisisNames = exports.CrisisCollector = exports.emptyCrisis = exports.crisisName = exports.CRISIS_KINDS = void 0;
exports.applyCrisis = applyCrisis;
exports.crisisRadioDirective = crisisRadioDirective;
exports.crisisFacts = crisisFacts;
exports.crisisNewsDirective = crisisNewsDirective;
exports.markCrisisIssue = markCrisisIssue;
exports.crisisSpecialFact = crisisSpecialFact;
// 은하 위기 특집 방송(2026-10-17): 종말 위기가 은하에 있는 동안 신문은 "위기 특별판", 라디오는 "긴급 특별 방송"으로 바뀐다.
// 순수 로직만 둔다. 모드가 매달 CRISIS(kind)… → CRISIS_END 를 남기고, 앱은 묶음마다 지금 있는 위기 목록을 새로 정한다.
const i18n_pick_1 = require("./i18n-pick");
exports.CRISIS_KINDS = {
    prethoryn: { ko: '프레토린 스컬지', en: 'Prethoryn Scourge' },
    unbidden: { ko: '불청객', en: 'The Unbidden' },
    contingency: { ko: '컨틴전시', en: 'The Contingency' },
    cetana: { ko: '세타나', en: 'Cetana' },
    khan: { ko: '대칸', en: 'The Great Khan' },
};
const crisisName = (k, lang = 'ko') => exports.CRISIS_KINDS[k]?.[lang] ?? k;
exports.crisisName = crisisName;
const emptyCrisis = () => ({ active: [], since: {}, ended: {}, issues: [] });
exports.emptyCrisis = emptyCrisis;
/** 한 달 묶음을 모은다: CRISIS 줄은 쌓고, CRISIS_END 에서 묶음을 돌려준다. */
class CrisisCollector {
    cur = new Set();
    feed(kind, kv) {
        if (kind === 'CRISIS') {
            const k = String(kv.kind ?? '').trim();
            if (exports.CRISIS_KINDS[k])
                this.cur.add(k);
            return null;
        }
        if (kind === 'CRISIS_END') {
            const kinds = [...this.cur].sort();
            this.cur.clear();
            return { kinds, date: String(kv.date ?? '').trim() };
        }
        return null;
    }
}
exports.CrisisCollector = CrisisCollector;
/** 이번 달 목록을 반영한다. 새로 생긴 위기·끝난 위기를 돌려준다. */
function applyCrisis(s, kinds, date) {
    const now = new Set(kinds.filter((k) => exports.CRISIS_KINDS[k]));
    const began = [...now].filter((k) => !s.active.includes(k)), ended = s.active.filter((k) => !now.has(k));
    for (const k of began) {
        s.since[k] = date;
        delete s.ended[k];
    }
    for (const k of ended)
        s.ended[k] = date;
    s.active = [...now].sort();
    return { began, ended };
}
const crisisNames = (kinds, lang = 'ko') => kinds.map((k) => (0, exports.crisisName)(k, lang)).join(lang === 'en' ? ', ' : '·');
exports.crisisNames = crisisNames;
/** 연대기(세계 소식) 한 줄 */
const crisisBeginText = (k) => (0, i18n_pick_1.L)(`은하 위기 "${(0, exports.crisisName)(k)}"이(가) 나타났다 — 은하 전역이 비상 체제에 들어갔다`, `Galactic crisis "${(0, exports.crisisName)(k, 'en')}" has appeared — the whole galaxy is on emergency footing`); // 기록 당시 인터페이스 언어(2026-10-19)
exports.crisisBeginText = crisisBeginText;
const crisisEndText = (k) => (0, i18n_pick_1.L)(`은하 위기 "${(0, exports.crisisName)(k)}"의 세력이 은하에서 사라졌다`, `The forces of galactic crisis "${(0, exports.crisisName)(k, 'en')}" have vanished from the galaxy`);
exports.crisisEndText = crisisEndText;
/** 라디오: 위기 동안 대본 작가에게 덧붙이는 지시(사실은 여전히 사건 목록만). */
function crisisRadioDirective(s) {
    if (!s.active.length)
        return null;
    const list = s.active.map((k) => `"${(0, exports.crisisName)(k, 'en')}" (since ${s.since[k] || 'unknown date'})`).join(', ');
    return [
        `[EMERGENCY SPECIAL BROADCAST] The galaxy is now facing the end-times crisis ${list}. This episode airs as an "emergency special broadcast" instead of regular programming.`,
        'The first line must announce the special programming (like "This is an emergency special broadcast"), and the last line must end by urging listeners to stay calm and follow general safety advice (e.g. listen for evacuation announcements).',
        'Tone: urgent disaster-broadcast style that does not stoke panic. No jokes or light chatter.',
        'Apart from the crisis forces\' names and start dates, do not invent damage figures, battle results or fallen planets that are not in the event list. Say "this has not been confirmed" for anything unknown.',
    ].join('\n');
}
/** 라디오: 새 사건이 없는 달에도 위기 동안에는 가상 일상 코너 대신 위기 특보를 낸다. */
function crisisFacts(s, today) {
    return s.active.map((k) => `Galactic crisis "${(0, exports.crisisName)(k, 'en')}" ongoing (first confirmed ${s.since[k] || 'on an unknown date'}${today ? `, today ${today}` : ''})`);
}
/** 신문: 위기 동안 내는 호에 덧붙이는 지시. */
function crisisNewsDirective(s) {
    if (!s.active.length)
        return null;
    return [
        `[CRISIS SPECIAL EDITION] The galaxy is now facing the end-times crisis ${s.active.map((k) => `"${(0, exports.crisisName)(k, 'en')}"`).join(', ')}. This issue is a "crisis special edition".`,
        'Lead the headline and first article with the crisis, but do not invent damage, victories or fallen planets not in the fact list. Report other news in the context of a galaxy in crisis. Leave out light entertainment and gossip.',
    ].join('\n');
}
/** 위기 특별판 호만 표시한다(정기호·일반 호외는 위기 중이라도 평소 지면). 최근 200개만 남긴다. */
function markCrisisIssue(s, id, label) {
    if (!Number.isFinite(id) || s.issues.includes(id))
        return;
    s.issues.push(id);
    (s.labels ??= {})[String(id)] = label;
    while (s.issues.length > 200) {
        const old = s.issues.shift();
        delete s.labels[String(old)];
    }
}
/** 위기가 새로 나타났을 때 특별판에 실을 한 문장(여러 위기가 한꺼번에 나타나면 함께). */
function crisisSpecialFact(kinds, date) { return `${date ? date + ' ' : ''}Galactic crisis ${kinds.map((k) => `"${(0, exports.crisisName)(k, 'en')}"`).join(', ')} appeared. The whole galaxy went on emergency footing.`; } // AI 신문 프롬프트용 사실(영어)
//# sourceMappingURL=crisis.js.map