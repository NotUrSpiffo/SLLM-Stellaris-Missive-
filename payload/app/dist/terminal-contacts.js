"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalContacts = exports.CT_KEYS = void 0;
exports.contactTypeKey = contactTypeKey;
/** 모드 CONTACT 의 ct(나라 종류 번호, 2026-10-19) → 종류 키. 게임의 GetCountryType 은 번역 이름(「몰락한 제국」「원시」)을 줄 때가 있어서 번호를 믿는다.
 *  번호 0(그 밖)인데 이름이 영문 키가 아니면(번역된 바닐라 종류: 티얀키·쿠톨로이드 등) 'vanilla_other' — 통신 목록에서 뺀다. ct 가 없으면(옛 모드) 그대로. */
exports.CT_KEYS = ['', 'default', 'fallen_empire', 'awakened_fallen_empire', 'primitive', 'enclave', 'mindwarden_enclave', 'caravaneer_home', 'dormant_marauders', 'awakened_marauders', 'ruined_marauders'];
function contactTypeKey(type, ct) {
    const t = String(type ?? '').trim();
    if (ct === undefined || ct === '')
        return t;
    const n = Number(ct);
    if (Number.isInteger(n) && n > 0 && n < exports.CT_KEYS.length)
        return exports.CT_KEYS[n];
    return /^[a-z0-9_]+$/i.test(t) ? t : 'vanilla_other';
}
/** Only completed, matching snapshots become visible. Unknown empires never enter this list. */
class TerminalContacts {
    sid = '';
    date = '';
    items = [];
    /** 플레이어 제국의 정체: 0 일반, 1 기계 지성, 2 군집 의식 */
    playerGest = 0;
    pending = null;
    reset() { this.sid = ''; this.date = ''; this.items = []; this.pending = null; this.playerGest = 0; }
    feed(m) {
        const k = m.kv;
        if (m.kind === 'CONTACT_BEGIN') {
            if (!/^\d{1,9}$/.test(k.sid || '') || !k.n)
                return false;
            this.pending = { sid: k.sid, n: k.n, date: k.date || '', gest: k.gest === '1' ? 1 : k.gest === '2' ? 2 : 0, items: [] };
            return false;
        }
        const p = this.pending;
        if (!p || k.sid !== p.sid || k.n !== p.n)
            return false;
        if (m.kind === 'CONTACT') {
            const idx = Number(k.idx), score = Number(k.score);
            if (k.rel !== 'comm' || !Number.isSafeInteger(idx) || idx <= 0 || !k.name || !Number.isFinite(score))
                return false;
            if (!p.items.some(c => c.idx === idx))
                p.items.push({ idx, name: k.name.slice(0, 100), type: contactTypeKey(k.type, k.ct), score, gest: k.gest === '1' ? 1 : k.gest === '2' ? 2 : 0 });
        }
        if (m.kind !== 'CONTACT_END')
            return false;
        this.sid = p.sid;
        this.date = p.date;
        this.playerGest = p.gest;
        this.items = p.items.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
        this.pending = null;
        return true;
    }
}
exports.TerminalContacts = TerminalContacts;
//# sourceMappingURL=terminal-contacts.js.map