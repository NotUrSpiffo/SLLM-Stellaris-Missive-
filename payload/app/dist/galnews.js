"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXTRA_KINDS = exports.IssueStore = exports.FEW_FACTS = exports.MIN_FACTS = exports.MAX_ARTICLES = exports.REPORTERS = exports.paperPrompt = exports.PAPERS = void 0;
exports.pickPaper = pickPaper;
exports.assignReporters = assignReporters;
exports.extraMessages = extraMessages;
exports.parseExtra = parseExtra;
exports.collectFacts = collectFacts;
exports.mergeWarFacts = mergeWarFacts;
exports.newsMessages = newsMessages;
exports.parseIssue = parseIssue;
exports.paperLines = paperLines;
const diagnostics_1 = require("./diagnostics");
// 은하 뉴스: 해마다 제국별 연대기에 쌓인 사실로 신문 한 호를 만든다. 연대기에 없는 일은 쓰지 않는다.
// 엿들은 소문(게임 사실이 아님)은 재료가 아니다. 되감기(시간선)를 따라가도록 호마다 분기 번호를 둔다.
const fs = __importStar(require("fs"));
const mail_1 = require("./mail");
exports.PAPERS = [
    { briefsFact: false, name: '성간일보', sub: 'INTERSTELLAR TIMES · 별빛 너머의 소식', wire: '성간 통신망 STN 제휴', bg: '#ece3cd', ink: '#1d1a14', accent: '#8a2a1c', comments: true,
        tone: '차분하고 격식 있는 정통 일간지 문체',
        slant: '보수적인 신문입니다. 평화주의적인 행보와 외계 종족에 우호적인 행보(예: 다른 종족이 많은 제국과의 동맹·협정)에는 비관적이고 우려하는 논조로 쓰고, 플레이어 제국의 군사적 행동에는 찬성하는 논조로 씁니다. 외계 종족에 배타적인 시각을 드러내되 욕설이나 모욕 표현은 쓰지 않습니다. 사실 자체를 바꾸지는 않고 평가와 어조에만 반영합니다.' },
    { briefsFact: false, name: '별무리 속보', sub: 'STARCLUSTER FLASH · 지금 이 순간의 은하', wire: '별무리 속보국', bg: '#dde7ec', ink: '#13202a', accent: '#0a5c8a', comments: true,
        tone: '핵심부터 쓰는 속보 문체이되 짧지 않고 충분히 설명한다',
        slant: '진보적인 신문입니다. 평화주의적이고 외계 종족에 우호적인 행보는 환영하고, 외계 종족에 배타적인 사건과 전쟁에는 비관적·비판적인 논조로 씁니다. 때로는 외계 종족 친화적인 발언을 거리낌 없이 합니다. 사실 자체를 바꾸지는 않고 평가와 어조에만 반영합니다.' },
    { briefsFact: true, name: '공허 통신', sub: 'VOID WIRE · 아무도 말하지 않는 것', wire: '공허 통신 특파원단', bg: '#dcd5c4', ink: '#221c28', accent: '#6a2a8a', comments: false,
        tone: '냉소적이고 날카로운 시사 주간지 문체',
        slant: '중립적인 신문입니다. 어느 편도 들지 않고 사실을 가장 정확하게 씁니다. 기자의 의견은 싣지 않고 사실만 씁니다.' },
];
/** 프롬프트용 영어 문체·성향(기본 신문사 글일 때만 바꾼다. 사용자가 고친 페르소나는 그대로 보낸다 — 2026-10-19 프롬프트 영어화). */
const PAPER_PROMPT_EN = {
    [exports.PAPERS[0].tone]: 'calm, formal style of a traditional daily newspaper',
    [exports.PAPERS[0].slant]: 'A conservative newspaper. It writes pessimistically and with concern about pacifist moves and alien-friendly moves (e.g. alliances or pacts with empires of many species), and approvingly about the player empire\'s military actions. It shows a xenophobic view but never uses slurs or insults. It never changes the facts themselves; the leaning shows only in judgments and tone.',
    [exports.PAPERS[1].tone]: 'breaking-news style that leads with the key point, yet explains fully rather than tersely',
    [exports.PAPERS[1].slant]: 'A progressive newspaper. It welcomes pacifist and alien-friendly moves, and writes pessimistically and critically about xenophobic events and wars. At times it speaks openly in favor of aliens. It never changes the facts themselves; the leaning shows only in judgments and tone.',
    [exports.PAPERS[2].tone]: 'cynical, sharp style of a current-affairs weekly',
    [exports.PAPERS[2].slant]: 'A neutral newspaper. It takes no side and reports the facts as accurately as possible. It prints no reporter opinions, only facts.',
    '아래 페르소나에 지정된 문체와 관점을 따릅니다.': 'Follow the style and viewpoint given in the persona below.',
};
/** 프롬프트에 넣을 문체·성향(기본 글이면 영어로, 사용자 글이면 그대로). */
const paperPrompt = (p) => ({ tone: PAPER_PROMPT_EN[p.tone] ?? p.tone, slant: PAPER_PROMPT_EN[p.slant] ?? p.slant });
exports.paperPrompt = paperPrompt;
exports.REPORTERS = ['오르비스 카엘', '세렌 도하', '마르쿠 벨', '이사 노르윈', '타리 쿤', '레베카 오스', '둔 하르마', '넬 이시다'];
/** 직전 호와 다른 신문사 번호를 고른다. */
function pickPaper(last, rnd = Math.random, enabled) {
    const on = exports.PAPERS.map((_, i) => i).filter((i) => !enabled || enabled[i] !== false);
    if (!on.length)
        return -1;
    const pool = on.filter((i) => i !== last);
    const use = pool.length ? pool : on; // 켜진 신문사가 하나뿐이면 계속 그곳
    return use[Math.min(use.length - 1, Math.floor(rnd() * use.length))];
}
/** 기사마다 기자 이름을 붙인다(같은 호 안에서 겹치지 않게). */
function assignReporters(articles, seed) {
    return articles.map((a, i) => ({ ...a, reporter: exports.REPORTERS[(seed + i * 3) % exports.REPORTERS.length] }));
}
/** 한 호의 기사 수 상한(2026-10-17 사용자 확정: 항상 최대 3건). */
exports.MAX_ARTICLES = 3;
exports.MIN_FACTS = 0; // 사실이 없어도 "조용한 한 해" 호를 낸다
exports.FEW_FACTS = 3;
class IssueStore {
    file;
    branchOf;
    data = { next: 1, items: [] };
    constructor(file, branchOf) {
        this.file = file;
        this.branchOf = branchOf;
        try {
            const j = JSON.parse(fs.readFileSync(file, 'utf8'));
            if (j && Array.isArray(j.items))
                this.data = { next: Number(j.next) || 1, items: j.items };
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                (0, diagnostics_1.logDiagnostic)('warn', 'storage.read_failed', { store: 'newspaper', file, error });
        }
    }
    // 쓰다가 꺼져도 지난 신문이 다 사라지지 않게 임시 파일에 쓴 뒤 바꾼다(2026-10-18)
    save() { try {
        const tmp = this.file + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(this.data), 'utf8');
        fs.renameSync(tmp, this.file);
    }
    catch (error) {
        (0, diagnostics_1.logDiagnostic)('error', 'storage.write_failed', { store: 'newspaper', file: this.file, error });
    } }
    list(sid) { return this.data.items.filter((i) => i.sid === sid); }
    /** 같은 날짜의 호가 이 시간선에 이미 있는가. */
    has(sid, date) { const br = this.branchOf(sid); return this.data.items.some((i) => i.sid === sid && !i.extra && i.date === date && (i.branch ?? 1) === br); } // 호외는 정기 호와 날짜가 겹쳐도 막지 않는다
    /** 이 시간선에서 그 해(YYYY)에 낸 호외 수 */
    extraCount(sid, year) { const br = this.branchOf(sid); return this.data.items.filter((i) => i.sid === sid && i.extra && i.date.slice(0, 4) === year && (i.branch ?? 1) === br).length; }
    add(sid, date, body, paper = 0, extra = false) {
        const id = this.data.next++;
        const it = { id, sid, date, ...body, articles: assignReporters(body.articles, id), paper, branch: this.branchOf(sid), ...(extra ? { extra: true } : {}) };
        this.data.items.push(it);
        while (this.data.items.length > 200)
            this.data.items.shift();
        this.save();
        return it;
    }
}
exports.IssueStore = IssueStore;
/** 호외가 될 만한 큰 사건 종류와 우선순위(클수록 먼저). 한 달에 하나, 한 해에 설정한 횟수까지만 낸다. */
exports.EXTRA_KINDS = { destroyed: 5, war: 4, crisis: 4, subject: 3, war_end: 3, war_sq: 3, scandal: 3, expel: 3 }; // expel: 대사 추방(2026-10-20) // scandal: 비방 공작 추문(2026-10-20)
/** 호외: 사건 한 건을 헤드라인 한 줄과 기사 한 건으로만 쓴다(나머지 지면은 화면에서 가짜 글씨로 채운다). */
function extraMessages(player, date, fact, paper = exports.PAPERS[0], info = []) {
    const pp = (0, exports.paperPrompt)(paper);
    const system = [
        `You are the editor of the newspaper "${paper.name}". You are writing a one-page extra (breaking news) edition dated ${date}. Style: ${pp.tone}. The reader is the leader of ${player}.`,
        `The newspaper's leaning: ${pp.slant}`,
        `Write only about the single "Event" below. Do not invent events, numbers, people or reasons. "We/our" in the text means ${player} (write ${player} by name in the article).`,
        paper.comments ? 'You may add one sentence of the reporter\'s subjective opinion at the end of the article body.' : 'Write facts only; add no opinion.',
        'Reply with one JSON only: {"headline":"one-line extra headline","title":"article title","body":"two or three sentences"}',
    ].join('\n');
    const user = (info.length ? 'Related empire information (for judging tone only; do not report it as fact):\n' + info.join('\n') + '\n\n' : '') + 'Event:\n- ' + fact;
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
}
function parseExtra(raw) {
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s < 0 || e <= s)
        return null;
    let o;
    try {
        o = JSON.parse(raw.slice(s, e + 1));
    }
    catch {
        return null;
    }
    const str = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
    const headline = str(o?.headline, 120), body = str(o?.body, 500), title = str(o?.title, 80) || headline;
    if (!headline || !body)
        return null;
    return { headline, articles: [{ title, body }], briefs: [] };
}
/** 제국별 연대기 묶음에서 since 이후의 사실을 모은다(세계 소식은 같은 날짜·같은 문장을 한 번만, 제국별 기록은 제국마다). */
function collectFacts(groups, since, max = 40, until = '') {
    const seen = new Set();
    const out = [];
    for (const g of groups)
        for (const e of g.items) {
            if (!e.date || (0, mail_1.cmpDate)(e.date, since) < 0 || (until && (0, mail_1.cmpDate)(e.date, until) > 0))
                continue;
            const k = e.date + '|' + e.text + '|' + (e.world ? '' : g.name); // 세계 소식은 여러 제국에 같은 글이 있으니 합치고, 제국별 기록은 따로 둔다
            if (seen.has(k))
                continue;
            seen.add(k);
            out.push({ date: e.date, text: e.text, who: g.name });
        }
    out.sort((a, b) => (0, mail_1.cmpDate)(a.date, b.date));
    return mergeWarFacts(out).slice(-max);
}
// 참전 줄은 기록 당시 인터페이스 언어로 쌓인다(mail.ts): 한국어 '전쟁 "x": y이(가) 참전했다' / 영어 'War "x": y joined'(2026-10-19).
const WAR_JOIN = /^(?:전쟁 "(.+)": (.+)이\(가\) 참전했다|War "(.+)": (.+) joined)$/;
/** 같은 전쟁에 참전한 제국들의 사실(참전국마다 따로 남은 줄)을 한 줄로 묶는다. 날짜는 처음 참전한 날. */
function mergeWarFacts(facts) {
    const out = [];
    const at = new Map();
    for (const f of facts) {
        const r = WAR_JOIN.exec(f.text);
        if (!r) {
            out.push(f);
            continue;
        }
        const en = r[3] !== undefined, m = en ? [r[0], r[3], r[4]] : [r[0], r[1], r[2]];
        const g = at.get(m[1]);
        if (!g) {
            at.set(m[1], { i: out.length, who: [m[2]] });
            out.push({ ...f });
            continue;
        }
        if (!g.who.includes(m[2]))
            g.who.push(m[2]);
        out[g.i] = { ...out[g.i], text: en ? `War "${m[1]}": ${g.who.join(', ')} joined` : `전쟁 "${m[1]}": ${g.who.join(', ')}이(가) 참전했다`, who: out[g.i].who === f.who ? f.who : (en ? 'several empires' : '여러 제국') };
    }
    return out;
}
function newsMessages(player, date, facts, paper = exports.PAPERS[0], info = []) {
    const pp = (0, exports.paperPrompt)(paper);
    const system = [
        `You are the editor of the newspaper "${paper.name}". You are writing one issue dated ${date}. Style: ${pp.tone}. The reader is the leader of ${player}.`,
        `The newspaper's leaning: ${pp.slant}`,
        `Write only about what is in "Facts of the past year" below. Do not invent events, numbers, people or reasons. "We/our" in the text means ${player} (write ${player} by name in the articles).`,
        paper.comments
            ? 'Each article body reports the facts, with this newspaper\'s leaning coloring the tone. End each article body with one sentence of the reporter\'s subjective opinion (there is no separate commentary field). An opinion is only an opinion: do not invent events or numbers not in the chronicle, and speak of the future only as "might ...".'
            : 'Article bodies report facts only; add no opinion.',
        'If the facts include a war, federation, pact or alliance between other empires that does not involve the player empire, at least one of them must be an article. Do not fill the paper only with the player empire.',
        'Reply with one JSON only: {"headline":"one-line lead headline","articles":[{"title":"title","body":"about three sentences"}],"briefs":["one-line item"]}',
        facts.length >= exports.FEW_FACTS
            ? 'articles: 2-3. If facts are about different things, write a separate article per event; only group truly same-kind items (e.g. first contact with several empires) into one article.'
            : 'This year is a "quiet year" with few recorded facts. Write only as many articles as there are facts (0-' +
                Math.max(1, facts.length) +
                '); if there are no facts, leave articles as an empty array. The headline should say it was a quiet year without inventing events. That nothing happened is itself a fact and may be written.',
        paper.briefsFact
            ? 'briefs is the "one-liners" column at the bottom. This newspaper writes only facts here too. Write 3-5 facts that did not make it into the articles, one short sentence each (under about 50 characters), and include no made-up stories at all.'
            : 'briefs is the "one-liners" column at the bottom. This column contains no facts at all. Write only 3-5 made-up funny items, one very short sentence each (under about 50 characters), stating just the incident with no explanation. Mix two kinds: (1) rumors in a "word is that ..." tone (do not use the words "hearsay" or "rumor has it"), (2) everyday mishaps (e.g. black comedy like a human neighbor caught trying to mine away a lithoid resident over floor noise). Do not mention or imitate events from the facts above (wars, treaties, alliances, leaders\' actions, etc.); write only about trivial everyday quirks of unnamed residents. Empire names and species may be used as background. No real-world people or organizations. No gruesome descriptions; keep it to laughs.',
    ].join('\n');
    const user = (info.length ? 'Related empire information (for judging tone only; do not report it as fact):\n' + info.join('\n') + '\n\n' : '') + 'Facts of the past year:\n' + (facts.length ? '' : '(no recorded events)') + facts.map((f) => `- ${f.date} (${f.who}) ${f.text}`).join('\n');
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
}
function parseIssue(raw) {
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s < 0 || e <= s)
        return null;
    let o;
    try {
        o = JSON.parse(raw.slice(s, e + 1));
    }
    catch {
        return null;
    }
    const str = (v, n) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : '');
    const headline = str(o?.headline, 120);
    const articles = (Array.isArray(o?.articles) ? o.articles : [])
        .map((a) => ({ title: str(a?.title, 80), body: str(a?.body, 500), comment: str(a?.comment, 200) }))
        .filter((a) => a.title && a.body)
        .map((a) => (a.comment ? a : { title: a.title, body: a.body }))
        .slice(0, exports.MAX_ARTICLES);
    const briefs = (Array.isArray(o?.briefs) ? o.briefs : []).map((b) => str(b, 60)).filter(Boolean).slice(0, 5);
    if (!headline || (!articles.length && !briefs.length))
        return null;
    return { headline, articles, briefs };
}
/** 프롬프트에 넣을 줄들: 머리기사 한 줄과 기사 제목·본문. 너무 길면 자른다. */
function paperLines(it, max = 700) {
    if (!it)
        return [];
    const out = [`[${it.date}] ${it.headline}`];
    let n = out[0].length; // 기자 논평은 의견이라 AI 가 읽는 요약에 넣지 않는다
    for (const a of it.articles) {
        const l = `- ${a.title}: ${a.body}`;
        if (n + l.length > max)
            break;
        out.push(l);
        n += l.length;
    }
    return out;
}
//# sourceMappingURL=galnews.js.map