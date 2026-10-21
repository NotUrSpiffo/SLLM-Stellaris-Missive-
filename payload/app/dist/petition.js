"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.petitionTextOk = exports.cleanPetText = exports.emptyPet = exports.taskOverdue = exports.pickReward = exports.TASK_CHECK_EVERY = exports.TASK_REWARD_DAYS = exports.TASK_MONTHS = exports.TASK_CHANCE = exports.REWARD_KINDS = exports.TASK_REWARDS = exports.BUILD_CATS = exports.BUILD_TASKS = exports.PET_EXPIRE_MONTHS = exports.PET_MAX_PENDING = exports.PET_CHANCE = exports.DECLINE_DAYS = exports.ACCEPT_DAYS = exports.DECLINE_MOD = exports.PETITION_TOPIC_KEYS = exports.PETITION_TOPICS = void 0;
exports.pickTaskCat = pickTaskCat;
exports.taskDue = taskDue;
exports.addMonthsP = addMonthsP;
exports.petitionTick = petitionTick;
exports.pickPetitionPlanet = pickPetitionPlanet;
exports.pickPetitionTopic = pickPetitionTopic;
exports.petitionMessages = petitionMessages;
exports.taskPetitionMessages = taskPetitionMessages;
exports.petitionCountCommand = petitionCountCommand;
exports.taskRewardCommand = taskRewardCommand;
exports.readPetition = readPetition;
exports.petitionApplyCommand = petitionApplyCommand;
const planets_1 = require("./planets");
const i18n_pick_1 = require("./i18n-pick");
exports.PETITION_TOPICS = {
    amenities: { ko: '여가 시설 확충', en: 'More amenities', mod: 'sllm_buff_amenities_t2', effKo: '편의 시설 산출 +10%', effEn: 'Amenities +10%', res: 'energy', amt: 150, ask: 'please add more leisure and amenity facilities (parks, cultural venues, shopping streets)' },
    housing: { ko: '주거 대책', en: 'Housing relief', mod: 'sllm_buff_housing_t2', effKo: '주거 사용량 −10%', effEn: 'Housing usage −10%', res: 'minerals', amt: 200, ask: 'there are not enough homes, so please provide housing relief' },
    security: { ko: '치안 강화', en: 'Better security', mod: 'sllm_buff_crime_t2', effKo: '범죄율 −10', effEn: 'Crime −10', res: 'energy', amt: 100, ask: 'we fear crime and unrest, so please strengthen public security' },
    festival: { ko: '축제와 휴일', en: 'Festival & holiday', mod: 'sllm_buff_happiness_t2', effKo: '인구 행복 +5%', effEn: 'Pop happiness +5%', res: 'consumer_goods', amt: 100, ask: 'please declare a festival and holidays so we can catch our breath from hard days' },
    jobs: { ko: '일자리 지원', en: 'Job support', mod: 'sllm_buff_jobs_t1', effKo: '일자리 생산 +5%', effEn: 'Job output +5%', res: 'minerals', amt: 150, ask: 'please support industry and jobs (factory equipment, job training)' },
    family: { ko: '가족 지원', en: 'Family support', mod: 'sllm_buff_popgrowth_t2', effKo: '인구 성장 속도 +10%', effEn: 'Pop growth speed +10%', res: 'food', amt: 200, ask: 'please support families raising children (food rations, childcare support)' },
};
exports.PETITION_TOPIC_KEYS = Object.keys(exports.PETITION_TOPICS);
exports.DECLINE_MOD = 'sllm_debuff_happiness_t1'; // 인구 행복 −2%
exports.ACCEPT_DAYS = 720, exports.DECLINE_DAYS = 360;
/** 청원 도착: 매달(게임 월 계산마다) 이 확률로 1건(사용자 결정 2026-10-19: 2.25%) · 쌓이는 최대 수 · 답하지 않으면 사라지는 개월. */
exports.PET_CHANCE = 0.0225;
exports.PET_MAX_PENDING = 3, exports.PET_EXPIRE_MONTHS = 12;
/** 건물 키(바닐라 3.x~4.x 이름. 버전·모드마다 다를 수 있어 게임에서 확인 필요 — 없는 키는 그냥 거짓). */
exports.BUILD_TASKS = {
    housing: { ko: '주거 건물 짓기', en: 'Build housing', ask: 'there are not enough homes, so please build housing (apartments, luxury residences, etc.) on this planet', topic: 'housing',
        keys: ['building_communal_housing', 'building_luxury_residence', 'building_paradise_dome', 'building_hive_warren', 'building_drone_storage'] },
    economy: { ko: '경제 건물 짓기', en: 'Build an economic building', ask: 'please build an economic building (factory, foundry, commercial zone, etc.) on this planet so jobs and income grow', topic: 'jobs',
        keys: ['building_factory', 'building_foundry', 'building_commercial_zone', 'building_commercial_megaplex', 'building_mineral_purification_plant', 'building_food_processing_facility', 'building_chemical_plant', 'building_refinery'] },
    energy: { ko: '에너지 건물 짓기', en: 'Build an energy building', ask: 'we suffer blackouts and high power bills, so please build an energy-credit building (power plant, etc.) on this planet', topic: 'amenities',
        keys: ['building_energy_grid', 'building_energy_nexus', 'building_dark_matter_power_core', 'building_power_plant_1'] },
};
exports.BUILD_CATS = Object.keys(exports.BUILD_TASKS);
exports.TASK_REWARDS = {
    stability: { mod: 'sllm_petition_stability', ko: '행성 안정도 +5', en: 'Planet stability +5' },
    happiness: { mod: 'sllm_buff_happiness_t2', ko: '인구 행복 +5%', en: 'Pop happiness +5%' },
    output: { mod: 'sllm_buff_jobs_t1', ko: '행성 산출(일자리 생산) +5%', en: 'Planet output (job production) +5%' },
};
exports.REWARD_KINDS = Object.keys(exports.TASK_REWARDS);
/** 청원 하나가 건설 과제일 확률(아주 가끔) · 과제 기한(개월) · 보상 기간(일) · 진행 확인 간격(개월). */
exports.TASK_CHANCE = 0.1, exports.TASK_MONTHS = 24, exports.TASK_REWARD_DAYS = 720, exports.TASK_CHECK_EVERY = 3;
/** 그 행성에 맞는 건설 과제(주거 부족이면 주거, 아니면 무작위). */
function pickTaskCat(p, rand = Math.random) {
    if ((p.housing ?? 0) < 0)
        return 'housing';
    return exports.BUILD_CATS[Math.floor(rand() * exports.BUILD_CATS.length)];
}
const pickReward = (rand = Math.random) => exports.REWARD_KINDS[Math.floor(rand() * exports.REWARD_KINDS.length)];
exports.pickReward = pickReward;
/** 진행 중 과제를 지금 확인할 때인지(마지막 확인 뒤 TASK_CHECK_EVERY 개월, 또는 기한이 지났을 때). */
function taskDue(task, date) {
    const now = ym(date);
    if (now === null)
        return false;
    const u = task.until ? ym(task.until) : null;
    if (u !== null && now >= u)
        return true;
    const c = task.checked ? ym(task.checked) : null;
    return c === null || now - c >= exports.TASK_CHECK_EVERY;
}
const taskOverdue = (task, date) => { const now = ym(date), u = task.until ? ym(task.until) : null; return now !== null && u !== null && now >= u; };
exports.taskOverdue = taskOverdue;
const emptyPet = () => ({ next: 1, due: '', pending: 0, items: [] });
exports.emptyPet = emptyPet;
const ym = (d) => { const m = /^(\d{3,5})\.(\d{1,2})/.exec(String(d || '').trim()); return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null; };
function addMonthsP(date, n) {
    const m = /^(\d{3,5})\.(\d{1,2})(?:\.(\d{1,2}))?/.exec(String(date || '').trim());
    if (!m)
        return '';
    const t = Number(m[1]) * 12 + Number(m[2]) - 1 + n;
    const two = (x) => String(x).padStart(2, '0');
    return `${Math.floor(t / 12)}.${two((t % 12) + 1)}.${two(m[3] ? Number(m[3]) : 1)}`;
}
/** 매달: 청원이 올 때가 됐으면 대기 수를 늘린다(처음 본 달에는 3개월 뒤로 첫 날짜를 정함). 오래된 청원은 사라짐. 돌려주는 값: 새로 도착한 수. */
function petitionTick(s, date, rand = Math.random) {
    const now = ym(date);
    if (now === null)
        return 0;
    for (const p of s.items)
        if (p.state === 'open') {
            const a = ym(p.date);
            if (a !== null && now - a >= exports.PET_EXPIRE_MONTHS) {
                p.state = 'expired';
                p.decided = date;
            }
        }
    const open = s.items.filter((p) => p.state === 'open').length;
    if (s.pending + open >= exports.PET_MAX_PENDING)
        return 0;
    if (rand() >= exports.PET_CHANCE)
        return 0; // 매달 2.25%
    s.pending++;
    return 1;
}
/** 청원을 올릴 행성 고르기: 문제가 있는 행성(여가·주거 부족, 낮은 안정도)을 먼저, 이미 청원 중인 행성은 빼고. */
function pickPetitionPlanet(planets, busy, rand = Math.random) {
    const cand = planets.filter((p) => p.name && !busy.includes(p.name));
    if (!cand.length)
        return null;
    const score = (p) => ((p.amenities ?? 0) < 0 ? 3 : 0) + ((p.housing ?? 0) < 0 ? 3 : 0) + ((p.stability ?? 50) < 40 ? 2 : 0) + (p.capital ? 1 : 0) + rand() * 2.5;
    return cand.map((p) => ({ p, s: score(p) })).sort((a, b) => b.s - a.s)[0].p;
}
/** 그 행성 사정에 맞는 청원 주제. */
function pickPetitionTopic(p, rand = Math.random) {
    if ((p.amenities ?? 0) < 0)
        return 'amenities';
    if ((p.housing ?? 0) < 0)
        return 'housing';
    if ((p.stability ?? 50) < 35)
        return rand() < 0.5 ? 'security' : 'festival';
    const pool = ['festival', 'jobs', 'family', 'security', 'amenities'];
    return pool[Math.floor(rand() * pool.length)];
}
/** 청원서(AI): 그 행성 주민들의 목소리로. */
function petitionMessages(a) {
    const t = exports.PETITION_TOPICS[a.topic];
    const sys = [
        `You represent the residents of the planet "${a.planet.name}" in the Stellaris empire "${a.empire || 'our empire'}". You are submitting a citizens' petition to the ruler ${a.ruler || '(Your Excellency)'}. Date: ${a.date || 'unknown'}.`,
        `[Planet situation (facts confirmed in the game)] ${(0, planets_1.planetFacts)(a.planet)}`,
        `[Petition request] ${t.ask}.`,
        'Format: a short one-line title + a 3-5 sentence body. Use a concrete but humble voice drawn from residents\' daily lives (e.g. the commute, the children, the market). Do not invent figures or events not in the facts above, and do not mention threats or rebellion. End with a signature such as "The citizens\' representatives of ○○".',
        'Output only one JSON object: {"title":"...","text":"..."}',
    ].join('\n');
    return [{ role: 'system', content: sys }, { role: 'user', content: '[Write the petition]' }];
}
/** 건설 과제 청원서(AI). */
function taskPetitionMessages(a) {
    const t = exports.BUILD_TASKS[a.cat];
    const sys = [
        `You represent the residents of the planet "${a.planet.name}" in the Stellaris empire "${a.empire || 'our empire'}". You are submitting a citizens' petition to the ruler ${a.ruler || '(Your Excellency)'}. Date: ${a.date || 'unknown'}.`,
        `[Planet situation (facts confirmed in the game)] ${(0, planets_1.planetFacts)(a.planet)}`,
        `[Petition request] ${t.ask}. This is not a request for money or goods; it asks for such a building to be built on this planet.`,
        'Format: a short one-line title + a 3-5 sentence body, in a humble voice drawn from residents\' daily lives. Do not invent figures or events not in the facts above, and do not mention threats or rebellion. End with a signature such as "The citizens\' representatives of ○○".',
        'Output only one JSON object: {"title":"...","text":"..."}',
    ].join('\n');
    return [{ role: 'system', content: sys }, { role: 'user', content: '[Write the petition]' }];
}
/** 건설 과제: 행성 k 에 그 범주의 건물이 몇 종류 있는지 센다 → SLLM:PETITIONCHECK req·status(ok/no_target)·count. */
function petitionCountCommand(req, sid, k, cat) {
    if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(k) || k < 1 || !exports.BUILD_TASKS[cat])
        throw new Error((0, i18n_pick_1.L)('청원 확인 인자가 올바르지 않습니다.', 'Invalid petition check arguments.'));
    const count = exports.BUILD_TASKS[cat].keys.map((key) => `if = { limit = { has_building = ${key} } prev = { change_variable = { which = sllm_pt_c value = 1 } } }`).join(' ');
    const log = (status) => `log = "SLLM:PETITIONCHECK/;/req=${req}/;/sid=${sid}/;/status=${status}/;/count=\\[This.sllm_pt_c]"`;
    const loop = `set_variable = { which = sllm_pt_n value = 0 } set_variable = { which = sllm_pt_ok value = 0 } set_variable = { which = sllm_pt_c value = 0 } every_owned_colony = { prev = { change_variable = { which = sllm_pt_n value = 1 } } if = { limit = { prev = { check_variable = { which = sllm_pt_n value = ${k} } } } ${count} prev = { set_variable = { which = sllm_pt_ok value = 1 } } } }`;
    const done = `if = { limit = { check_variable = { which = sllm_pt_ok value = 1 } } ${log('ok')} } else = { ${log('no_target')} } clear_variable = sllm_pt_n clear_variable = sllm_pt_ok clear_variable = sllm_pt_c`;
    return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } ${loop} ${done} }`;
}
/** 건설 과제 완수 보상: 행성 k 에 보상 수정자(2년). 응답은 PETITIONAPPLY(applied/no_target). */
function taskRewardCommand(req, sid, k, reward) {
    if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(k) || k < 1 || !exports.TASK_REWARDS[reward])
        throw new Error((0, i18n_pick_1.L)('청원 보상 인자가 올바르지 않습니다.', 'Invalid petition reward arguments.'));
    const mod = exports.TASK_REWARDS[reward].mod;
    const log = (status) => `log = "SLLM:PETITIONAPPLY/;/req=${req}/;/sid=${sid}/;/status=${status}"`;
    const loop = `set_variable = { which = sllm_pt_n value = 0 } set_variable = { which = sllm_pt_ok value = 0 } every_owned_colony = { prev = { change_variable = { which = sllm_pt_n value = 1 } } if = { limit = { prev = { check_variable = { which = sllm_pt_n value = ${k} } } } remove_modifier = ${mod} add_modifier = { modifier = ${mod} days = ${exports.TASK_REWARD_DAYS} } prev = { set_variable = { which = sllm_pt_ok value = 1 } } } }`;
    return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } ${loop} if = { limit = { check_variable = { which = sllm_pt_ok value = 1 } } ${log('applied')} } else = { ${log('no_target')} } clear_variable = sllm_pt_n clear_variable = sllm_pt_ok }`;
}
const cleanPetText = (v, n) => String(v ?? '').replace(/^```[a-z]*\s*|```\s*$/gi, '').replace(/[ \t]+/g, ' ').trim().slice(0, n);
exports.cleanPetText = cleanPetText;
/**
 * AI 청원 답 읽기(2026-10-19 집 PC 실기: 답이 JSON 중간에서 끊겨 화면에 `{ "title": "…", "text` 가 그대로 나왔다).
 * 온전한 JSON → 그대로. 끊긴 JSON → 닫히지 않은 "text" 값까지 살리고 마지막 완성 문장까지만. JSON 이 아니면 글 그대로(첫 줄이 짧으면 제목).
 * 본문이 없으면 text 가 빈 문자열(호출 쪽이 다시 묻거나 실패 처리). 예전에 저장된 깨진 청원을 보여 줄 때도 쓴다.
 */
function readPetition(raw) {
    const s = String(raw ?? '').replace(/^\s*```[a-z]*\s*|```\s*$/gi, '').trim();
    const un = (x) => { try {
        return JSON.parse('"' + x.replace(/\\$/, '') + '"');
    }
    catch {
        return x.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    } };
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a >= 0 && b > a) {
        try {
            const j = JSON.parse(s.slice(a, b + 1));
            if (j && typeof j === 'object' && (typeof j.text === 'string' || typeof j.title === 'string'))
                return { title: String(j.title ?? '').trim(), text: String(j.text ?? '').trim(), partial: false };
        }
        catch { /* 끊긴 JSON: 아래 */ }
    }
    if (/^\s*\{|"(title|text)"\s*:/.test(s)) {
        const f = (k) => { const m = new RegExp('"' + k + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)("?)').exec(s); return m ? { v: un(m[1]).trim(), closed: m[2] === '"' } : null; };
        const ti = f('title'), tx = f('text');
        let text = tx?.v ?? '';
        if (tx && !tx.closed) {
            let cut = -1;
            for (const m of text.matchAll(/[.!?。！？…](?=["'”’)\]]*(\s|$))/g))
                cut = (m.index ?? 0) + 1;
            text = cut > 0 ? text.slice(0, cut) : '';
        }
        return { title: ti?.closed ? ti.v : '', text, partial: !tx || !tx.closed };
    }
    const lines = s.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    if (lines.length > 1 && lines[0].length <= 80)
        return { title: lines[0].replace(/^#+\s*|^\*\*|\*\*$/g, ''), text: lines.slice(1).join('\n'), partial: false };
    return { title: '', text: s, partial: false };
}
/** 화면에 보여도 될 만큼 온전한 청원 본문인가(너무 짧거나 JSON 조각이 아님). */
const petitionTextOk = (text) => text.length >= 40 && !/^\s*\{|"(title|text)"\s*:/.test(text);
exports.petitionTextOk = petitionTextOk;
/**
 * 게임에 결정을 건다. k = 행성 목록(every_owned_colony 순서, 총독 화면과 같은 순서)에서의 번호(1부터).
 * 수락: 자원이 모자라면 short, 그 행성에 수정자 + 자원 차감 → applied. 거절: 불만 수정자 → applied. 행성을 못 찾으면 no_target.
 */
function petitionApplyCommand(req, sid, k, accept, topic) {
    if (!Number.isSafeInteger(req) || req < 1 || !/^\d+$/.test(sid) || !Number.isSafeInteger(k) || k < 1 || !exports.PETITION_TOPICS[topic])
        throw new Error((0, i18n_pick_1.L)('청원 결정 인자가 올바르지 않습니다.', 'Invalid petition decision arguments.'));
    const t = exports.PETITION_TOPICS[topic], mod = accept ? t.mod : exports.DECLINE_MOD, days = accept ? exports.ACCEPT_DAYS : exports.DECLINE_DAYS;
    const log = (status) => `log = "SLLM:PETITIONAPPLY/;/req=${req}/;/sid=${sid}/;/status=${status}"`;
    const loop = `set_variable = { which = sllm_pt_n value = 0 } set_variable = { which = sllm_pt_ok value = 0 } every_owned_colony = { prev = { change_variable = { which = sllm_pt_n value = 1 } } if = { limit = { prev = { check_variable = { which = sllm_pt_n value = ${k} } } } remove_modifier = ${mod} add_modifier = { modifier = ${mod} days = ${days} } prev = { set_variable = { which = sllm_pt_ok value = 1 } } } }`;
    const done = `if = { limit = { check_variable = { which = sllm_pt_ok value = 1 } } ${accept ? `add_resource = { ${t.res} = -${t.amt} } ` : ''}${log('applied')} } else = { ${log('no_target')} } clear_variable = sllm_pt_n clear_variable = sllm_pt_ok`;
    const body = accept ? `if = { limit = { NOT = { has_resource = { type = ${t.res} amount >= ${t.amt} } } } ${log('short')} } else = { ${loop} ${done} }` : `${loop} ${done}`;
    return `effect every_playable_country = { limit = { is_ai = no check_variable = { which = sllm_save_id value = ${sid} } } ${body} }`;
}
//# sourceMappingURL=petition.js.map