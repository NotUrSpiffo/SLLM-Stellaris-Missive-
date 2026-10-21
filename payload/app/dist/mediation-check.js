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
exports.runMediationChecks = runMediationChecks;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const mediation_1 = require("./mediation");
function runMediationChecks() {
    const check = (ok, name) => { console.log((ok ? 'PASS ' : 'FAIL ') + 'mediation: ' + name); if (!ok)
        process.exitCode = 1; };
    const throws = (f) => { try {
        f();
        return false;
    }
    catch {
        return true;
    } };
    const start = (0, mediation_1.newMediation)((0, mediation_1.mediationFixture)(), 'scripted');
    check(start.phase === 'invitation' && start.gameApplied === false, 'start is invitation, no game effect');
    const invite = (0, mediation_1.advanceMediation)(start, 0, 'invite', (0, mediation_1.scriptedMediationReplies)(start));
    check(invite.phase === 'negotiating' && invite.round === 0, 'attending is not peace agreement');
    check(start.phase === 'invitation' && start.log.length === 0, 'transition does not mutate original');
    const counter = (0, mediation_1.advanceMediation)(invite, 1, 'proposal', (0, mediation_1.scriptedMediationReplies)(invite));
    check(counter.phase === 'negotiating' && counter.replies[1].decision === 'counter', 'counteroffer blocks agreement');
    const agreed = (0, mediation_1.advanceMediation)(counter, 2, 'same unconditional proposal', (0, mediation_1.scriptedMediationReplies)(counter));
    check(agreed.phase === 'agreed' && agreed.round === 2 && !agreed.gameApplied, 'both agree to same proposal without game application');
    const compromise = (0, mediation_1.reviseMediationOffer)(agreed, { basis: 'negotiated', claims: ['altair', 'vega'], goalFor: null });
    check(compromise.phase === 'negotiating' && compromise.replies.length === 0 && compromise.revision === agreed.revision + 1, 'new terms reset both consents and reopen unsaved agreement');
    check((0, mediation_1.offerSummary)(compromise).length === 2 && (0, mediation_1.offerSummary)(compromise)[0].includes('알타이르'), 'reciprocal claims have explicit destinations');
    check(throws(() => (0, mediation_1.validateMediationOffer)(start.war, { basis: 'white_peace', claims: ['altair'], goalFor: null })), 'white peace cannot smuggle transfers');
    check(throws(() => (0, mediation_1.validateMediationOffer)(start.war, { basis: 'negotiated', claims: ['unknown'], goalFor: null })), 'unknown claim rejected');
    check(throws(() => (0, mediation_1.validateMediationOffer)(start.war, { basis: 'negotiated', claims: ['altair', 'altair'], goalFor: null })), 'duplicate claim rejected');
    check(throws(() => (0, mediation_1.validateMediationOffer)(start.war, { basis: 'negotiated', claims: [], goalFor: 99 })), 'foreign war goal rejected');
    check(throws(() => (0, mediation_1.reviseMediationOffer)({ ...agreed, recorded: true }, { basis: 'white_peace', claims: [], goalFor: null })), 'saved agreement immutable');
    const statusQuo = (0, mediation_1.reviseMediationOffer)(invite, { basis: 'status_quo', claims: [], goalFor: null });
    check(statusQuo.proposal === 'status_quo' && (0, mediation_1.offerSummary)(statusQuo).length === 2, 'status quo uses supplied outcomes independently from white peace');
    check(JSON.parse((0, mediation_1.mediationMessages)(compromise, 'agree')[1].content).proposal.claims.length === 2, 'AI receives current structured compromise');
    check(throws(() => (0, mediation_1.advanceMediation)(compromise, agreed.revision, 'late', agreed.replies)), 'old proposal revision cannot agree to new terms');
    check(throws(() => (0, mediation_1.advanceMediation)(agreed, 3, 'again', agreed.replies)), 'terminal agreement cannot continue');
    check(throws(() => (0, mediation_1.advanceMediation)(invite, 0, 'old', invite.replies)), 'stale revision rejected');
    const refused = (0, mediation_1.advanceMediation)(start, 0, 'invite', [{ id: 1, decision: 'reject', text: 'No' }, { id: 2, decision: 'accept', text: 'Yes' }]);
    check(refused.phase === 'declined', 'refused invitation ends mediation');
    check(throws(() => (0, mediation_1.advanceMediation)(refused, 1, 'again', refused.replies)), 'declined invitation cannot negotiate');
    const rejection = (0, mediation_1.advanceMediation)(invite, 1, 'proposal', [{ id: 1, decision: 'reject', text: 'No' }, { id: 2, decision: 'accept', text: 'Yes' }]);
    check(rejection.phase === 'negotiating', 'rejected proposal still permits negotiation');
    for (const [label, raw] of [['empty', '{"replies":[]}'], ['null', 'null'], ['bad JSON', 'broken'], ['foreign ID', '{"replies":[{"id":1,"decision":"accept","text":"a"},{"id":3,"decision":"accept","text":"b"}]}'], ['duplicate', '{"replies":[{"id":1,"decision":"accept","text":"a"},{"id":1,"decision":"accept","text":"b"}]}'], ['unknown decision', '{"replies":[{"id":1,"decision":"war_ended","text":"a"},{"id":2,"decision":"accept","text":"b"}]}'], ['empty text', '{"replies":[{"id":1,"decision":"accept","text":" "},{"id":2,"decision":"accept","text":"b"}]}']])
        check(throws(() => (0, mediation_1.parseMediationReplies)(raw, start)), label + ' rejected atomically');
    check(throws(() => (0, mediation_1.parseMediationReplies)(JSON.stringify({ replies: counter.replies }), start)), 'counter invalid during invitation');
    check(throws(() => (0, mediation_1.newMediation)({ ...(0, mediation_1.mediationFixture)(), parties: [start.war.parties[0], start.war.parties[0]] }, 'ai')), 'same empire twice rejected');
    check((0, mediation_1.mediationMessages)(invite, 'transfer all planets')[0].content.includes('The mediator cannot add binding terms'), 'free text cannot redefine the actionable treaty');
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'sllm-mediation-'));
    try {
        const file = path.join(temp, 'records.json'), records = new mediation_1.MediationRecords(file);
        check(throws(() => records.save(invite)), 'unfinished results not recorded');
        check(throws(() => records.save({ ...agreed, replies: counter.replies })), 'false agreement not recorded');
        records.save(agreed);
        records.save(agreed);
        check(records.list().length === 1, 'duplicate save idempotent');
        check(new mediation_1.MediationRecords(file).list()[0].gameApplied === false, 'restart preserves not-applied state');
        const separate = (0, mediation_1.newMediation)((0, mediation_1.mediationFixture)(), 'scripted');
        records.save((0, mediation_1.advanceMediation)(separate, 0, 'invite', refused.replies));
        check(records.list().length === 2, 'refused invitations can be recorded');
        check(records.list().every(r => r.war.source === 'fixture'), 'test source is preserved');
        fs.writeFileSync(file, 'broken');
        check(throws(() => records.save(agreed)) && fs.readFileSync(file, 'utf8') === 'broken', 'corrupt storage preserved');
    }
    finally {
        fs.rmSync(temp, { recursive: true, force: true });
    }
}
//# sourceMappingURL=mediation-check.js.map