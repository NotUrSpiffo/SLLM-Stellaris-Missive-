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
exports.runDinnerChecks = runDinnerChecks;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const dinner_1 = require("./dinner");
const inbox_store_1 = require("./inbox-store");
function runDinnerChecks() {
    const check = (ok, name) => { console.log((ok ? 'PASS ' : 'FAIL ') + 'dinner: ' + name); if (!ok)
        process.exitCode = 1; };
    const throws = (f) => { try {
        f();
        return false;
    }
    catch {
        return true;
    } };
    check((0, dinner_1.validDinnerDate)('2200.01.30') && !(0, dinner_1.validDinnerDate)('2200.13.01') && !(0, dinner_1.validDinnerDate)('2200.01.31'), 'valid Stellaris calendar');
    check(!(0, dinner_1.dinnerAcceptance)(200, { war: true }, 0), 'war rejects invitation');
    check((0, dinner_1.dinnerAcceptance)(150, {}, 0.85), 'friendly relation more likely to accept');
    check(!(0, dinner_1.dinnerAcceptance)(-150, {}, 0.2), 'hostile relation can reject');
    check(!(0, dinner_1.dinnerAcceptance)(150, { rival: true }, 0.3), 'rivalry reduces acceptance');
    check((0, dinner_1.parseDinnerReply)('{"text":"Thank you"}') === 'Thank you', 'structured reply');
    check(throws(() => (0, dinner_1.parseDinnerReply)('{"accepted":true}')), 'missing body rejected');
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sllm-dinner-'));
    try {
        const file = path.join(temp, 'dinner.json'), store = new dinner_1.DinnerStore(file), base = { sid: '123456', branch: 1, idx: 2, name: 'Guest', ruler: 'Ruler', sent: '2200.11.01', body: 'Please visit.' };
        const row = store.add(base, 3);
        check(row.due === '2201.02.01', 'three-month reply crosses year');
        check(store.due(base.sid, 1, '2201.01.01').length === 0, 'not due early');
        check(store.due(base.sid, 1, '2201.02.01').length === 1, 'due at three months');
        check(store.due(base.sid, 2, '2201.02.01').length === 0, 'other time branch cannot deliver');
        check(store.due('987654', 1, '2201.02.01').length === 0, 'other save cannot deliver');
        check(throws(() => store.add({ ...base, idx: 3 }, 6)), 'one active visit per timeline');
        check(throws(() => store.add({ ...base, branch: 2 }, 2)), 'reply delay below three blocked');
        check(throws(() => store.add({ ...base, branch: 2 }, 7)), 'reply delay above six blocked');
        store.update({ ...row, phase: 'accepted', arrival: '2201.08.01', accepted: true });
        check(store.due(base.sid, 1, '2201.07.01').length === 0, 'accepted waits for six-month arrival');
        check(store.due(base.sid, 1, '2201.08.01').length === 1, 'arrival due at six months');
        check(new dinner_1.DinnerStore(file).list(base.sid, 1)[0].phase === 'accepted', 'reservation survives restart');
        check((0, dinner_1.dinnerEffect)(row, 7).includes('VID = 1') && (0, dinner_1.dinnerEffect)(row, 7).includes('sllm_save_id value = 123456'), 'save and visit scoped command');
        check((0, dinner_1.dinnerEffect)(row, 8, true).includes('sllm_probe_dinner_status'), 'uncertainty uses read-only status');
        check(throws(() => (0, dinner_1.dinnerEffect)({ ...row, idx: NaN }, 8)), 'invalid target command blocked');
        check(JSON.parse((0, dinner_1.dinnerReplyMessages)({ ...row, accepted: true, arrival: '2201.08.01' }, null, 100)[1].content).arrivalDate === '2201.08.01', 'AI gets authoritative arrival date');
        const inboxFile = path.join(temp, 'inbox.json'), inbox = new inbox_store_1.InboxStore(inboxFile), letter = { idx: 2, name: 'Guest', date: '2201.02.01', text: 'We accept', read: false, proposal: null, expires: '2203.02.01', sourceId: 'dinner-reply:1' };
        inbox.add(base.sid, 1, letter);
        inbox.add(base.sid, 1, letter);
        check(inbox.list(base.sid).length === 1, 'reply is idempotent');
        const restored = new inbox_store_1.InboxStore(inboxFile);
        restored.add(base.sid, 1, letter);
        check(restored.list(base.sid).length === 1, 'reply stays idempotent after restart');
        fs.writeFileSync(inboxFile, 'broken');
        check(throws(() => new inbox_store_1.InboxStore(inboxFile).add(base.sid, 1, letter)) && fs.readFileSync(inboxFile, 'utf8') === 'broken', 'corrupt inbox preserved for invitation reply');
        fs.writeFileSync(file, 'broken');
        check(throws(() => store.add(base, 3)) && fs.readFileSync(file, 'utf8') === 'broken', 'corrupt reservations fail closed');
    }
    finally {
        fs.rmSync(temp, { recursive: true, force: true });
    }
    const mod = fs.readFileSync(path.join(__dirname, '..', 'tester-mod', 'common', 'scripted_effects', 'sllm_probe_dinner.txt'), 'utf8'), events = fs.readFileSync(path.join(__dirname, '..', 'tester-mod', 'events', 'sllm_probe_dinner_events.txt'), 'utf8');
    check(mod.includes('energy = -1000') && mod.includes('energy = -100'), 'requested resource costs');
    check(!mod.slice(mod.indexOf('sllm_probe_dinner_humiliating =')).includes('add_resource'), 'humiliating reception free');
    check((events.match(/option =/g) || []).length === 3, 'three in-game reception options');
    check(mod.includes('has_country_flag = sllm_dinner_open') && mod.includes('remove_country_flag = sllm_dinner_open'), 'selection guard prevents repeat charges');
}
//# sourceMappingURL=dinner-check.js.map