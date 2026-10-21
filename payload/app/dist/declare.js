"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DECL_VOICE_INSTRUCT = exports.declTitle = exports.DECL_KEEP = exports.DECL_MAX_CHARS = exports.DECL_MAX_LINES = void 0;
exports.sanitizeDecl = sanitizeDecl;
exports.cleanDeclText = cleanDeclText;
exports.warSide = warSide;
exports.declMessages = declMessages;
exports.parseDecl = parseDecl;
const music_1 = require("./music");
exports.DECL_MAX_LINES = 24, exports.DECL_MAX_CHARS = 2400, exports.DECL_KEEP = 40;
const sideOk = (v) => v === 'att' || v === 'def' || v === '';
const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
function sanitizeDecl(v) {
    const o = (v && typeof v === 'object' ? v : {}), saves = {};
    if (o.saves && typeof o.saves === 'object' && !Array.isArray(o.saves)) {
        for (const [sid, list] of Object.entries(o.saves).slice(0, 500)) {
            if (!Array.isArray(list))
                continue;
            const out = [];
            for (const d of list.slice(-exports.DECL_KEEP)) {
                if (!d || typeof d !== 'object')
                    continue;
                const x = d;
                const text = cleanDeclText(x.text);
                if (!text)
                    continue;
                out.push({ date: str(x.date, 20), war: str(x.war, 120), enemy: str(x.enemy, 120), side: sideOk(x.side) ? x.side : '', goal: str(x.goal, 60), title: (0, music_1.cleanTitle)(x.title), text, audio: Array.isArray(x.audio) ? x.audio.filter((a) => typeof a === 'string' && a.length < 600).slice(0, exports.DECL_MAX_LINES) : [], createdAt: typeof x.createdAt === 'number' && Number.isFinite(x.createdAt) ? x.createdAt : 0 });
            }
            if (out.length)
                saves[sid.slice(0, 60)] = out;
        }
    }
    return { saves };
}
/** 선언문 본문 정리: 줄 단위, 24줄·2400자. */
function cleanDeclText(v) {
    return (0, music_1.cleanLyrics)(v).split('\n').map((l) => l.trim()).filter(Boolean).slice(0, exports.DECL_MAX_LINES).join('\n').slice(0, exports.DECL_MAX_CHARS).trim();
}
/** 이 전쟁에서 우리 편: 월간 상황의 전쟁 목록에서 이름이 같은 전쟁을 찾는다(없으면 ''). */
function warSide(wars, warName) {
    const w = (wars ?? []).find((x) => x.name === warName) ?? (wars ?? []).slice(-1)[0];
    if (!w)
        return { side: '', enemy: '' };
    return { side: w.side, enemy: (w.side === 'att' ? w.defender : w.attacker) ?? '' };
}
const declTitle = (side, ko) => (side === 'def' ? (ko ? '항전 선언문' : 'Declaration of Resistance') : side === 'att' ? (ko ? '전쟁 선언문' : 'Declaration of War') : (ko ? '전쟁 선언문' : 'War declaration'));
exports.declTitle = declTitle;
/** AI 초안 요청: 통치자가 국민과 군에게 읽는 선언문. 실제 역사 연설을 베끼지 않게 한다. */
function declMessages(empire, war, enemy, side, ethics, gestalt, date, warInfo = '') {
    const sys = 'You write the address a head of state delivers to the nation and its armed forces at the outbreak of a war, in the game Stellaris. '
        + 'ORIGINAL text only: never copy or closely paraphrase any real-world speech. 8 to 14 short lines, one sentence per line, no numbering, no markdown, suitable to be read aloud over a broadcast. '
        + (side === 'def' ? 'We were attacked: a declaration of resistance — resolve, unity, the defense of home. ' : side === 'att' ? 'We opened the war: a declaration of war — the cause, the resolve, the call to arms. ' : '')
        + 'Ground the speech in the actual cause of the war given below (the casus belli and the relationship between the sides): a conquest speaks of claims and destiny, a liberation addresses the enemy\'s own people, a war of independence denounces the overlord, a defense speaks of home and resolve, a war against a galactic threat speaks for all. '
        + 'Reflect the empire\'s character. Output ONLY JSON: {"title":"short title","text":"line1\\nline2\\n..."}.';
    const traits = [ethics.length ? 'ethics: ' + ethics.join(', ') : '', gestalt ? 'a gestalt consciousness; speak as one collective' : ''].filter(Boolean).join('; ');
    const usr = `Empire: ${String(empire || 'the empire').slice(0, 80)}${war ? '\nWar: ' + war.slice(0, 120) : ''}${enemy ? '\nEnemy: ' + enemy.slice(0, 120) : ''}${warInfo ? '\nCause of the war: ' + warInfo.slice(0, 400) : ''}${traits ? '\nCharacter — ' + traits : ''}${date ? '\nGame date: ' + date : ''}\nWrite the declaration.`;
    return [{ role: 'system', content: sys }, { role: 'user', content: usr }];
}
function parseDecl(raw) {
    const s = typeof raw === 'string' ? raw : '';
    let title = '', text = '';
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a >= 0 && b > a) {
        try {
            const j = JSON.parse(s.slice(a, b + 1));
            title = (0, music_1.cleanTitle)(j.title);
            const t = j.text ?? j.lines;
            text = Array.isArray(t) ? t.filter((x) => typeof x === 'string').join('\n') : typeof t === 'string' ? t : '';
        }
        catch { /* 평문 */ }
    }
    if (!text && !(a >= 0 && b > a))
        text = s;
    text = cleanDeclText(text.split('\n').map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '')).join('\n'));
    return text.length >= 20 ? { title, text } : null;
}
exports.DECL_VOICE_INSTRUCT = 'Deliver this as a head of state addressing the nation over an emergency broadcast: grave, steady, resolute. No pause at the end.';
//# sourceMappingURL=declare.js.map