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
exports.registerConversationFavors = registerConversationFavors;
exports.settleConversationFavors = settleConversationFavors;
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const conversation_favors_1 = require("../conversation-favors");
const terminal_1 = require("./terminal");
const ctx_1 = require("../app/ctx");
const game_link_1 = require("../app/game-link");
const log_router_1 = require("../app/log-router");
const chronicle_app_1 = require("./chronicle-app");
const diagnostics_1 = require("../diagnostics");
const i18n_pick_1 = require("../i18n-pick"); // 한/영 문구(2026-10-19 영어 화면 점검)
const file = () => path.join(electron_1.app.getPath('userData'), 'sllm_favor_grants.json');
const read = () => { if (!fs.existsSync(file()))
    return {}; const v = JSON.parse(fs.readFileSync(file(), 'utf8')); if (v.version !== 1 || !v.grants || typeof v.grants !== 'object' || Array.isArray(v.grants))
    throw new Error((0, i18n_pick_1.L)('호의 지급 기록을 읽지 못했습니다. 기존 파일을 보존했습니다.', 'Could not read the favor grant record. The existing file was kept.')); return v.grants; };
const write = (v) => { const tmp = file() + '.tmp'; fs.writeFileSync(tmp, JSON.stringify({ version: 1, grants: v }, null, 2), 'utf8'); fs.renameSync(tmp, file()); };
let settlements = Promise.resolve();
function registerConversationFavors(router) { router.on(log_router_1.SLOT.FAVORS, 'conversation:favors', m => { if (m.kind === 'FAVORS')
    terminal_1.terminalReplies.get('FAVORS:' + m.kv.req)?.(m); }); router.on(log_router_1.SLOT.GIFT, 'banquet:gift', m => { if (m.kind === 'GIFT' || m.kind === 'SPECGIFT')
    terminal_1.terminalReplies.get(m.kind + ':' + m.kv.req)?.(m); }); }
function settleConversationFavors(key, sid, idx, amount, epoch) {
    const next = settlements.then(() => settle(key, sid, idx, amount, epoch));
    settlements = next.catch(() => { });
    return next;
}
async function settle(key, sid, idx, amount, epoch) {
    if (amount <= 0)
        return (0, i18n_pick_1.L)('이번 대화에서 적립된 호의가 없습니다.', 'No favors were earned in this conversation.');
    if (ctx_1.ctx.curSaveId !== sid || game_link_1.link.epoch !== epoch || !ctx_1.ctx.actionsAllowed(idx))
        return (0, i18n_pick_1.L)('게임 상태가 바뀌어 호의를 지급하지 않았습니다.', 'The game state changed, so no favors were granted.');
    try {
        const grants = read(), previous = grants[key];
        if (previous)
            return previous.message || (0, i18n_pick_1.L)('이미 요청한 호의입니다. 중복 지급하지 않습니다.', 'These favors were already requested. They will not be granted twice.');
        const cid = (0, crypto_1.randomUUID)().replace(/-/g, ''), req = ++game_link_1.link.reqCounter;
        const command = (0, conversation_favors_1.favorsCommand)(req, sid, idx, cid, amount);
        const record = grants[key] = { sid, idx, cid, req, requested: amount, status: 'uncertain', date: ctx_1.ctx.gameDate, message: (0, i18n_pick_1.L)('호의 지급 요청의 결과가 아직 확인되지 않았습니다. 자동 재전송하지 않습니다.', 'The result of the favor grant request is not confirmed yet. It will not be resent automatically.') };
        write(grants);
        try {
            const m = await (0, terminal_1.terminalRequest)(command, 'FAVORS', req);
            if (ctx_1.ctx.curSaveId !== sid || game_link_1.link.epoch !== epoch || m.kv.sid !== sid || m.kv.cid !== cid || Number(m.kv.idx) !== idx)
                throw new Error((0, i18n_pick_1.L)('호의 응답의 세이브·상대가 일치하지 않습니다.', 'The favor reply\'s save or empire does not match.'));
            const before = Number(m.kv.before), after = Number(m.kv.after), gained = after - before;
            if (m.kv.status === 'readback' && Number.isSafeInteger(before) && before >= 0 && Number.isSafeInteger(after) && gained >= 0 && gained <= amount) {
                Object.assign(record, { status: 'confirmed', before, after, gained, message: gained ? (0, i18n_pick_1.L)(`호의 ${gained}개 획득 확인 (보유 ${before} → ${after}).`, `Confirmed ${gained} favor(s) gained (held ${before} → ${after}).`) : (0, i18n_pick_1.L)(`호의 추가 없음 (보유 ${after}, 게임 한도·조건 확인 필요).`, `No favors added (held ${after}; check the game's limits and conditions).`) });
                if (gained)
                    (0, chronicle_app_1.chronNote)(idx, (0, i18n_pick_1.L)(`외교 대화가 잘 풀려 상대에게 행사할 호의 ${gained}개를 얻었다(게임 확인)`, `A diplomatic conversation went well and we gained ${gained} favor(s) with them (confirmed in game)`));
            }
            else if (m.kv.status === 'no_target') {
                record.status = 'rejected';
                record.message = (0, i18n_pick_1.L)('현재 통신 가능한 상대를 찾지 못해 호의를 지급하지 않았습니다.', 'No contactable counterpart was found, so no favor was granted.');
            }
            else
                record.message = (0, i18n_pick_1.L)('호의 적용 여부를 확인하지 못했습니다. 자동 재전송하지 않습니다.', 'Could not confirm whether the favor was applied. It will not be resent automatically.');
        }
        catch (e) {
            record.message = (0, i18n_pick_1.L)('호의 적용 여부를 확인하지 못했습니다. 자동 재전송하지 않습니다.', 'Could not confirm whether the favor was applied. It will not be resent automatically.');
            record.error = String(e);
        }
        // Merge with the latest ledger so another completed entry is never discarded.
        const latest = read();
        latest[key] = record;
        write(latest);
        (0, diagnostics_1.logDiagnostic)('info', 'conversation.favors', { sid, idx, req, status: record.status, gained: record.gained });
        return record.message;
    }
    catch (e) {
        (0, diagnostics_1.logDiagnostic)('warn', 'conversation.favors.failed', { error: String(e) });
        return (0, i18n_pick_1.L)('호의 정산을 완료하지 못했습니다. 기록과 게임 상태를 확인하세요.', 'Could not finish settling favor. Check the record and the game state.');
    }
}
//# sourceMappingURL=conversation-favors.js.map