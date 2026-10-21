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
exports.runSummitChecks = runSummitChecks;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const summit_core_1 = require("./summit-core");
const federation_1 = require("./federation");
const protocol_1 = require("./protocol");
function runSummitChecks() {
    const check = (v, label) => { console.log((v ? 'PASS ' : 'FAIL ') + 'summit: ' + label); if (!v)
        process.exitCode = 1; };
    const throws = (f) => { try {
        f();
        return false;
    }
    catch {
        return true;
    } };
    const f = { sid: '123456', name: 'Union', type: 'default_federation', level: 2, cohesion: 30, laws: ['vote_weight_equal', 'centralization_minimal'], warTargets: [{ idx: 7, name: 'Enemy' }], members: [{ idx: 1, name: 'Player', ruler: 'A', weight: 10, player: true, leader: false, stance: 0 }, { idx: 2, name: 'Member', ruler: 'B', weight: 20, player: false, leader: true, stance: 60 }] };
    const a = { kind: 'war', target: 7 }, clone = () => JSON.parse(JSON.stringify(f));
    check((0, summit_core_1.parseSummitReplies)('{"replies":[{"idx":2,"say":"Agree","stance":40}]}', [2])[0].stance === 40, 'valid reply');
    for (const [label, raw] of [['missing', '{"replies":[]}'], ['foreign', '{"replies":[{"idx":3,"say":"x","stance":0}]}'], ['range', '{"replies":[{"idx":2,"say":"x","stance":101}]}'], ['string stance', '{"replies":[{"idx":2,"say":"x","stance":"30"}]}'], ['empty speech', '{"replies":[{"idx":2,"say":" ","stance":30}]}'], ['malformed', 'garbage'], ['null', 'null']])
        check(throws(() => (0, summit_core_1.parseSummitReplies)(raw, [2])), label + ' rejected');
    check(throws(() => (0, summit_core_1.parseSummitReplies)('{"replies":[{"idx":2,"say":"x","stance":30},{"idx":2,"say":"x","stance":30}]}', [2, 3])), 'duplicate replies rejected');
    check(!(0, summit_core_1.summitApplyProblem)(f, a, 'yes', new Set([2])), 'all heard and passed');
    check(!!(0, summit_core_1.summitApplyProblem)(f, a, 'yes', new Set()), 'unheard blocked');
    check(!!(0, summit_core_1.summitApplyProblem)({ ...f, demo: true }, a, 'yes', new Set([2])), 'demo blocked');
    check(!!(0, summit_core_1.summitApplyProblem)(f, a, 'no', new Set([2])), 'failed vote blocked');
    check(!!(0, summit_core_1.summitApplyProblem)(f, { kind: 'war', target: 2 }, 'yes', new Set([2])), 'war on a member blocked');
    check(!!(0, summit_core_1.summitApplyProblem)(f, { kind: 'war', target: 99 }, 'yes', new Set([2])), 'war on unknown target blocked');
    check(!!(0, summit_core_1.summitApplyProblem)(f, { kind: 'war' }, 'yes', new Set([2])), 'war without target blocked');
    check(throws(() => (0, summit_core_1.summitApplyEffect)(f, { kind: 'war', target: 2 }, 4)), 'war effect on a member refused');
    check(throws(() => (0, summit_core_1.summitApplyEffect)(f, { kind: 'war', target: '7 } kill_country = yes' }, 4)), 'target injection blocked');
    check(throws(() => (0, summit_core_1.summitApplyEffect)({ ...f, sid: '1 }' }, a, 4)), 'save injection blocked');
    check(throws(() => (0, summit_core_1.summitApplyEffect)(f, a, NaN)), 'invalid request blocked');
    check((0, summit_core_1.summitApplyEffect)(f, a, 7).includes('sllm_probe_fed_war = { TARGET = 7 }') && (0, summit_core_1.summitApplyEffect)(f, a, 7).includes('value < 7'), 'war command uses the mod effect and request dedup guard');
    check((0, summit_core_1.summitApplyEffect)(f, { kind: 'cohesion' }, 8).includes('add_cohesion = 10'), 'bounded cohesion');
    check(!(0, summit_core_1.summitResultConfirmed)(f, f, a), 'war not confirmed without the game line');
    check(!(0, summit_core_1.summitResultConfirmed)(f, f, a, false), 'war at=0 not confirmed');
    check((0, summit_core_1.summitResultConfirmed)(f, f, a, true), 'war at=1 confirmed');
    const changed = clone();
    changed.cohesion = 40;
    check(!(0, summit_core_1.summitResultConfirmed)(f, { ...changed, sid: '987' }, { kind: 'cohesion' }), 'other save rejected');
    check(!(0, summit_core_1.summitResultConfirmed)(f, null, { kind: 'cohesion' }), 'missing response rejected');
    check(!(0, summit_core_1.summitResultConfirmed)(f, { ...changed, members: changed.members.slice(1) }, { kind: 'cohesion' }), 'different roster rejected');
    check(!(0, summit_core_1.summitResultConfirmed)(f, f, { kind: 'cohesion' }), 'unchanged cohesion rejected');
    check((0, summit_core_1.summitResultConfirmed)(f, { ...f, cohesion: 40 }, { kind: 'cohesion' }), 'cohesion increase confirmed');
    check((0, summit_core_1.federationFingerprint)(f) === (0, summit_core_1.federationFingerprint)({ ...f, members: f.members.map(m => ({ ...m, stance: -100 })) }), 'stance does not invalidate world snapshot');
    check((0, summit_core_1.federationFingerprint)(f) !== (0, summit_core_1.federationFingerprint)({ ...f, laws: [] }), 'changed laws invalidate snapshot');
    check((0, summit_core_1.federationFingerprint)(f) !== (0, summit_core_1.federationFingerprint)({ ...f, members: f.members.map(m => ({ ...m, ruler: 'changed' })) }), 'new ruler invalidates snapshot');
    check((0, federation_1.decisionRule)({ ...f, type: 'hegemony_federation' }, 'war').pass === 'unanimous', 'unknown hegemony rule never invents president authority');
    check((0, federation_1.decisionRule)({ ...f, laws: ['vote_weight_diplomatic_imperial_loyalists', 'declare_war_president_vote_imperial_loyalists'] }, 'war').known, 'variant rules recognized');
    check((0, protocol_1.fedReadEffect)(42).includes('sllm_fed_read_req value = 42'), 'read correlation');
    check(throws(() => (0, protocol_1.fedReadEffect)(-1)), 'invalid read request');
    check((0, summit_core_1.summitMessages)(f, a, [2], 'test', [], [])[0].content.includes('Never claim a game effect'), 'AI cannot declare game success');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sllm-summit-'));
    try {
        const file = path.join(tmp, 'journal.json'), j = new summit_core_1.SummitJournal(file), id = (0, summit_core_1.summitOperationId)(f, a, '2200.01.01');
        j.reserve(id, 'test');
        check(throws(() => new summit_core_1.SummitJournal(file).reserve(id, 'retry')), 'uncertain reservation survives restart');
        j.finish(id, 'confirmed');
        check(throws(() => j.reserve(id, 'retry')), 'confirmed request cannot repeat');
        check((0, summit_core_1.summitOperationId)(f, a, '2200.01.01') === (0, summit_core_1.summitOperationId)({ ...f, cohesion: 40 }, a, '2200.01.01'), 'same-day operation stable across changed cohesion');
        fs.writeFileSync(file, 'broken');
        check(throws(() => j.reserve('new', 'test')), 'corrupt journal fails closed');
    }
    finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}
//# sourceMappingURL=summit-check.js.map