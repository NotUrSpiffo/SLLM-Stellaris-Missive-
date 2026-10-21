"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEV_TURN_TEXT = exports.DEV_TRUNCATED_TURN = exports.DEV_RES_KEY = exports.DEV_GAME_ON = exports.DEV_OFF = exports.DEV_WAR = exports.DEV_START_DATE = exports.DEV_EMPIRES = exports.DEV_PLAYER = exports.DEV_SID = void 0;
exports.devGuard = devGuard;
exports.injectGuard = injectGuard;
exports.fakeLine = fakeLine;
exports.saveLines = saveLines;
exports.profileLine = profileLine;
exports.monthLine = monthLine;
exports.newsLines = newsLines;
exports.speechLines = speechLines;
exports.radioLines = radioLines;
exports.councilLines = councilLines;
exports.councilEndLine = councilEndLine;
exports.unparsable = unparsable;
exports.devTruncatedTurn = devTruncatedTurn;
exports.deliveryMessages = deliveryMessages;
exports.councilCheckSamples = councilCheckSamples;
exports.councilCheckText = councilCheckText;
exports.behaviorPreview = behaviorPreview;
exports.sampleIssue = sampleIssue;
exports.sampleRadio = sampleRadio;
exports.sampleFederation = sampleFederation;
exports.summitDemoReplies = summitDemoReplies;
// 개발자 도구(게임 없이 새 기능 화면 시험)의 순수 부분: 가짜 게임 로그 줄, 안전 검사, 견본 자료.
// Electron 을 쓰지 않는다(selftest 가 직접 부른다). 창·IPC·저장소는 src/features/dev-tools.ts.
// 가짜 자료는 모두 전용 세이브 번호 DEV_SID 와 제국 번호 9000~9004 에만 쓴다(실제 세이브와 섞이지 않게).
const protocol_1 = require("./protocol");
const prompt_1 = require("./prompt");
const council_state_1 = require("./council-state");
const native_bridge_1 = require("./native-bridge");
const speech_1 = require("./speech");
exports.DEV_SID = '1999999';
exports.DEV_PLAYER = { idx: 9000, name: '시험 플레이어' };
exports.DEV_EMPIRES = [
    { idx: 9001, name: '시험 제국 가' },
    { idx: 9002, name: '시험 제국 나' },
    { idx: 9003, name: '시험 제국 다' },
    { idx: 9004, name: '시험 제국 라' },
];
exports.DEV_START_DATE = '2230.01.01';
exports.DEV_WAR = '시험 대전쟁';
exports.DEV_OFF = '개발자 모드가 꺼져 있습니다.';
exports.DEV_GAME_ON = '게임이 연결돼 있어 가짜 게임 신호를 넣지 않았습니다. 게임을 끈 뒤 다시 시도해 주세요.';
/** 모든 개발자 시험 IPC 의 첫 검사: 개발자 모드가 꺼져 있으면 거절. */
function devGuard(devMode) { return devMode ? null : { ok: false, error: exports.DEV_OFF }; }
/** 가짜 게임 신호를 넣는 IPC 의 첫 검사: 개발자 모드가 꺼져 있거나 실제 게임이 연결돼 있으면 거절. */
function injectGuard(devMode, gameRunning) {
    return devGuard(devMode) ?? (gameRunning ? { ok: false, error: exports.DEV_GAME_ON } : null);
}
// 모드가 [..] 치환으로 찍는 칸은 값 앞에 '\'가 붙는다(protocol.ts 가 떼어 낸다). 글자 그대로 쓰는 칸은 붙이지 않는다.
const LITERAL = new Set(['kind', 'stage', 'phase', 'protocol', 'version', 'rel', 'key']);
/** 모드가 game.log 에 찍는 모양 그대로의 한 줄(로그 머리 + SLLM:KIND/;/키=값...). 값 안의 구분자와 줄바꿈은 지운다. */
function fakeLine(kind, fields) {
    const clean = (v) => String(v).replace(/\/;\//g, ' ').replace(/[\r\n]+/g, ' ');
    return `[00:00:00][sllm_dev_fake.cpp:1]: SLLM:${kind}` + fields.map(([k, v]) => `/;/${k}=${LITERAL.has(k) ? '' : '\\'}${clean(v)}`).join('');
}
const E = (i) => exports.DEV_EMPIRES[i];
/** 세이브를 불러온 것처럼: LOADED(세이브 번호·날짜) → 플레이어·제국 번호(IDX) → 제국 프로필(PROFILE). */
function saveLines(date) {
    return [
        fakeLine('LOADED', [['date', date], ['seq', 0], ['last', 0], ['sid', exports.DEV_SID]]),
        fakeLine('IDX', [['name', exports.DEV_PLAYER.name], ['idx', exports.DEV_PLAYER.idx], ['type', 'default'], ['rel', 'self']]),
        ...exports.DEV_EMPIRES.map((e) => fakeLine('IDX', [['name', e.name], ['idx', e.idx], ['type', 'default'], ['rel', 'contact']])),
        ...exports.DEV_EMPIRES.map((e, i) => profileLine(e.idx, i, 0)),
    ];
}
function profileLine(idx, i, beh) {
    const f = [['idx', idx], ['gov', '시험 공화국'], ['species', '시험 종족'], ['personality', '시험 성향'], ['origin', '시험 기원'], ['ruler', '시험 통치자 ' + (i + 1)], ['title', '의장'], ['home', '시험 모성'],
        ['war', 0], ['truce', 0], ['rival', 0], ['hostile', 0], ['unfriendly', i === 0 ? 1 : 0], ['friendly', i === 1 ? 1 : 0], ['fed', 0], ['nap', 0], ['def', 0], ['com', 0], ['res', 0], ['emb', 0], ['busy', 0],
        ['att', i === 0 ? 12 : 10], ['organ', '심장'], ['adj', '시험'], ['n', 1], ['cls', (i % 4) + 1]];
    if (beh > 0)
        f.push(['beh', beh]);
    return fakeLine('PROFILE', f);
}
function monthLine(date) { return fakeLine('MONTH', [['date', date], ['seq', 0], ['last', 0]]); }
/** F-01 신문 재료: AI 끼리의 통상·방위 협정, 같은 이름의 전쟁에 두 제국 참전(한쪽은 번호 0 → 이름·세계 소식 경로). */
function newsLines(date) {
    return [
        fakeLine('NEWS', [['kind', 'pact_com'], ['date', date], ['a', E(0).idx], ['aname', E(0).name], ['b', E(1).idx], ['bname', E(1).name]]),
        fakeLine('NEWS', [['kind', 'pact_def'], ['date', date], ['a', E(2).idx], ['aname', E(2).name], ['b', E(3).idx], ['bname', E(3).name]]),
        fakeLine('NEWS', [['kind', 'war'], ['date', date], ['a', E(0).idx], ['aname', E(0).name], ['war', exports.DEV_WAR]]),
        fakeLine('NEWS', [['kind', 'war'], ['date', date], ['a', 0], ['aname', E(1).name], ['war', exports.DEV_WAR]]),
    ];
}
/** F-02 연설: 국민 성향(SPEECHPF) → 결정을 누름(SPEECH phase=prep). */
function speechLines() {
    return [
        fakeLine('SPEECHPF', [['gov', '시험 민주 공화국'], ['mil', 1], ['pac', 0], ['aut', 0], ['ega', 1], ['xph', 1], ['xpb', 0], ['mat', 1], ['spi', 0], ['gest', 0], ['auth', 1], ['cls', 1], ['n', 1]]),
        fakeLine('SPEECH', [['phase', 'prep'], ['n', 1]]),
    ];
}
/** F-03 라디오: 여러 종류의 사건(EVT)과 세계 소식(NEWS). n 은 누를 때마다 달라야 중복으로 걸러지지 않는다. */
function radioLines(date, n) {
    return [
        fakeLine('EVT', [['kind', 'tech'], ['date', date], ['n', n], ['who', E(0).name]]),
        fakeLine('EVT', [['kind', 'war_start'], ['date', date], ['n', n], ['who', E(1).name], ['war', exports.DEV_WAR]]),
        fakeLine('EVT', [['kind', 'leader_death'], ['date', date], ['n', n], ['who', E(2).name], ['leader', '시험 제독']]),
        fakeLine('EVT', [['kind', 'megastructure'], ['date', date], ['n', n], ['who', E(3).name], ['what', '시험 고리 세계'], ['system', '시험 성계']]),
        fakeLine('EVT', [['kind', 'first_contact'], ['date', date], ['a', E(0).name], ['b', E(3).name]]),
        fakeLine('NEWS', [['kind', 'ruler'], ['date', date], ['a', E(1).idx], ['aname', E(1).name], ['ruler', '시험 통치자 ' + n]]),
        fakeLine('NEWS', [['kind', 'ally_join'], ['date', date], ['a', E(2).idx], ['aname', E(2).name], ['b', E(3).idx], ['bname', E(3).name]]),
    ];
}
exports.DEV_RES_KEY = 'resolution_commerce_buzzword_standardization';
/** F-15 의회: 안건 표결 시작, 안건 코드, 회원국 4곳(모두 AI · 플레이어는 비회원), 각 입장. */
function councilLines(date) {
    const w = [30, 25, 20, 15], pos = [1, 2, 3, 1];
    return [
        fakeLine('RESOLUTION', [['stage', 'vote'], ['date', date], ['proposer', E(0).idx], ['pname', E(0).name], ['target', 0], ['tname', '']]),
        fakeLine('RESKEY', [['key', exports.DEV_RES_KEY]]),
        ...exports.DEV_EMPIRES.map((e, i) => fakeLine('GCMEMBER', [['date', date], ['idx', e.idx], ['name', e.name], ['weight', w[i]], ['ai', 1], ['council', i === 0 ? 1 : 0], ['n', i + 1]])),
        ...exports.DEV_EMPIRES.map((e, i) => fakeLine('GCPOS', [['date', date], ['idx', e.idx], ['pos', pos[i]], ['n', i + 1]])),
    ];
}
/** 시험 안건을 끝낸다(표결 중 표시를 거둔다). */
function councilEndLine(date) { return fakeLine('RESOLUTION', [['stage', 'failed'], ['date', date], ['proposer', E(0).idx], ['pname', E(0).name]]); }
/** 줄을 protocol.ts 로 다시 읽어 본다(selftest 와 주입 전 확인용). 못 읽는 줄이 있으면 그 줄을 돌려준다. */
function unparsable(lines) { return lines.filter((l) => !(0, protocol_1.parseLogLine)(l)); }
/** F-26: 일부러 중간에 끊긴 군중 반응 JSON(마지막 반응의 문자열이 닫히지 않음). */
exports.DEV_TRUNCATED_TURN = '{"mood":7,"reactions":[{"type":"cheer","who":"부두 노동자","text":"옳소! 우리 손으로 지은 제국이다!"},{"type":"action","text":"광장 곳곳에서 박수가 번진다"},{"type":"say","who":"퇴역 군인","text":"말은 좋은데 정작 우리 연금은';
function devTruncatedTurn() { return (0, speech_1.parseTurn)(exports.DEV_TRUNCATED_TURN); }
exports.DEV_TURN_TEXT = '[시험] 잘린 응답 복구를 확인하는 발언입니다.';
/** F-12: bridge-client 결과별로 사용자에게 보이는 문장(파일·실행 없이 classifyDelivery 만 부른다). */
function deliveryMessages() {
    const cases = [
        ['exit 4 (게임 창을 못 찾음)', [4, undefined]],
        ['exit 2 (요청 형식 오류)', [2, undefined]],
        ['state 1 (DLL 연결 실패)', [8, { state: 1, result: 0, gameStatus: 0, exitCode: 8 }]],
        ['state 4 (10초 안에 받지 않음)', [0, { state: 4, result: 0, gameStatus: 0, exitCode: 0 }]],
        ['시간 초과(강제 종료)', [null, undefined, true]],
        ['성공 + exit 11 (훅 해제 실패)', [11, { state: 3, result: 0, gameStatus: 1, exitCode: 11 }]],
    ];
    const KO = { ok: '성공', fail: '실패', uncertain: '확인 안 됨' };
    return cases.map(([label, args]) => {
        const o = (0, native_bridge_1.classifyDelivery)(...args);
        return `${label} → ${KO[o.kind]}${o.kind === 'ok' ? '' : o.safeToRemove ? ' · 요청 파일 지움' : ' · 요청 파일 남김'}: ${o.message || '(오류 문구 없음 — 성공으로 처리)'}`;
    });
}
/** A-16: 표본 의회 두 개(찬성 80% → 허용, 79.9% → 거절)를 CouncilState.check 로 확인한다. 게임에는 아무것도 보내지 않는다. */
function councilCheckSamples() {
    const mk = (ws) => ({ key: 'resolution_dev_sample', demo: false, reliable: true, members: ws.map((w, i) => ({ idx: exports.DEV_PLAYER.idx + i, name: i ? E(i - 1).name : exports.DEV_PLAYER.name, weight: w, ai: i !== 0, pos: [0, 1, 2][i] })) });
    const out = [];
    for (const [label, ws] of [['찬성 80% (플레이어 20 + 찬성 60, 반대 20)', [20, 60, 20]], ['찬성 79.9% (플레이어 20 + 찬성 59.9, 반대 20.1)', [20, 59.9, 20.1]]]) {
        const s = new council_state_1.CouncilState();
        s.open(exports.DEV_SID, mk(ws));
        out.push({ label, result: s.check(exports.DEV_SID, 'resolution_dev_sample', true) });
    }
    return out;
}
function councilCheckText() {
    return councilCheckSamples().map(({ label, result }) => `${label} → ${result.ok ? `허용 (찬성 ${Math.round(result.pct.f * 10) / 10}%)` : '거절: ' + result.reason}`);
}
/** A-17: 가짜 PROFILE(beh 비트)로 대화 시스템 프롬프트가 어떤 줄을 담는지 보여 준다(LLM 호출 없음). */
function behaviorPreview(masks = [1 + 4, 8 + 16]) {
    const out = [];
    for (const mask of masks) {
        const m = (0, protocol_1.parseLogLine)(profileLine(E(0).idx, 0, mask));
        const pf = m ? (0, prompt_1.profileFrom)(m) : null;
        if (!pf) {
            out.push(`beh=${mask}: PROFILE 줄을 읽지 못했습니다.`);
            continue;
        }
        const talk = { idx: pf.idx, name: E(0).name, player: exports.DEV_PLAYER.name, opinionA: 0, opinionB: -10, score: -10, profile: pf.profile };
        const lines = (0, prompt_1.systemPrompt)(talk, { body: 'none' }).split('\n');
        out.push(`── beh=${mask} → behaviorText: "${(0, prompt_1.behaviorText)(pf.profile.beh)}"`);
        out.push(...lines.filter((l) => /hidden intent|^Your empire:|specific attitude toward them|Your relationship with them|Relations with them|속내|당신 제국의 설정|구체적 태도|상대와의 관계|태도는 "/.test(l)).map((l) => '  ' + l));
    }
    return out;
}
/** AI 연결 없이 화면을 확인하는 견본 신문(이름에 [시험 견본] 표시). */
function sampleIssue(date) {
    return {
        headline: `[시험 견본] ${exports.DEV_EMPIRES[0].name}·${exports.DEV_EMPIRES[1].name} 통상 협정, 같은 날 "${exports.DEV_WAR}" 참전`,
        articles: [
            { title: '[시험 견본] AI 제국끼리 통상 협정', body: `${date.slice(0, 4)}년, ${exports.DEV_EMPIRES[0].name}과 ${exports.DEV_EMPIRES[1].name}이 통상 협정을 맺었다. 이 기사는 AI 연결 없이 만든 시험용 견본이다.`, comment: '견본 논평: 화면 배치를 확인하는 문장이다.' },
            { title: '[시험 견본] 방위 협정 체결', body: `${exports.DEV_EMPIRES[2].name}과 ${exports.DEV_EMPIRES[3].name}이 방위 협정을 맺었다. 실제 게임 사건이 아니다.` },
            { title: `[시험 견본] "${exports.DEV_WAR}" 참전국 늘어`, body: `${exports.DEV_EMPIRES[0].name}과 ${exports.DEV_EMPIRES[1].name}이 같은 전쟁에 참전했다. 한쪽은 제국 번호 없이 이름만 기록된 경우를 시험한다.` },
        ],
        briefs: ['[시험 견본] 바위 종족 주민, 층간 소음 민원 접수', '[시험 견본] 로봇 공무원 휴가 신청서 3만 장 중복 제출'],
    };
}
/** AI 연결 없이 라디오 창을 확인하는 견본 대본(기자 연결 형식 8발언). */
function sampleRadio() {
    const L = [
        ['announcer', '[시험 견본] AI 연결 없이 만든 시험 방송입니다. 첫 소식부터 전합니다.'], ['reporter', `${exports.DEV_EMPIRES[0].name}의 기술 단계가 올랐다는 기록이 들어왔습니다.`],
        ['announcer', '전쟁 소식도 있다고요?'], ['reporter', `네, "${exports.DEV_WAR}"에 ${exports.DEV_EMPIRES[1].name}이 참전했습니다.`],
        ['announcer', '거대구조물 완공 소식은요?'], ['reporter', `${exports.DEV_EMPIRES[3].name}이 시험 성계에 시험 고리 세계를 완공했습니다.`],
        ['announcer', '오늘 소식 정리해 주시죠.'], ['reporter', '모두 시험용 가짜 사건입니다. 화면 확인을 마치면 시험 데이터를 지워 주세요.'],
    ];
    return L.map(([who, text]) => ({ who, text }));
}
// ---- A-01 연방 정상회담 1단계(화면 먼저): 가짜 연방과 정해진 대사. 게임 명령·LLM 호출 없음.
/** 시험 연방: 플레이어 + 시험 제국 4곳, 회장은 시험 제국 가. 법은 3.x 바닐라 키 추정(확인 필요). */
function sampleFederation() {
    const rulers = ['카엘 브란트 집정관', '수엔 일라 의장', '오르크 3세 왕', '테라 비샤 총통'];
    const stance = [70, 35, -40, 0];
    return {
        sid: exports.DEV_SID, name: '[시험] 오리온 통상 연합', type: 'trade_federation', level: 3, cohesion: 62, demo: true,
        laws: ['vote_weight_diplomatic', 'declare_war_majority_vote', 'succession_type_rotation'],
        warTargets: [{ idx: 9101, name: '[시험] 약탈자 제국' }, { idx: 9102, name: '[시험] 칼리온 공화국' }],
        members: [
            { idx: exports.DEV_PLAYER.idx, name: exports.DEV_PLAYER.name, ruler: '시험 플레이어 통치자', title: '대통령', cls: 'human', weight: 38, leader: false, player: true, stance: 0 },
            ...exports.DEV_EMPIRES.map((e, i) => ({ idx: e.idx, name: e.name, ruler: rulers[i], cls: ['avian', 'arthropoid', 'lithoid', 'aquatic'][i], weight: [52, 27, 19, 11][i], leader: i === 0, player: false, stance: stance[i] })),
        ],
    };
}
const SUMMIT_LINES = {
    yes: ['이 안건은 연방 모두에게 이롭습니다. 찬성합니다.', '좋은 제안입니다. 우리 함대도 함께하겠습니다.', '반대할 이유를 찾지 못했습니다.'],
    no: ['우리 주권을 내줄 수는 없습니다. 반대합니다.', '이 조건으로는 우리 국민을 설득할 수 없습니다.', '시기상조입니다. 다음 회담에서 다시 논의합시다.'],
    abstain: ['조금 더 생각해 보겠습니다.', '양쪽 말에 모두 일리가 있군요.', '우리 의회와 먼저 상의해야 합니다.'],
};
/**
 * 시연판 대답: 말한 상대(없으면 플레이어 말고 모두)가 정해진 대사로 짧게 한 번씩 답하고, 플레이어가 미는 방향으로 입장이 조금 움직인다.
 * turn 으로 대사와 움직임을 고른다(같은 입력이면 같은 결과 — 시험이 흔들리지 않게).
 */
function summitDemoReplies(info, to, playerVote, turn) {
    const push = playerVote === 'yes' ? 1 : playerVote === 'no' ? -1 : 0;
    return info.members.filter((m) => !m.player && (to === null || m.idx === to)).map((m, k) => {
        const delta = push * (6 + ((turn * 7 + k * 5) % 9)) * (to === null ? 1 : 1.5);
        const after = Math.max(-100, Math.min(100, m.stance + delta));
        const v = after >= 25 ? 'yes' : after <= -25 ? 'no' : 'abstain';
        const L = SUMMIT_LINES[v];
        return { idx: m.idx, name: m.name, say: '[시연] ' + L[(turn + k) % L.length], delta: Math.round(delta) };
    });
}
//# sourceMappingURL=dev-fake.js.map