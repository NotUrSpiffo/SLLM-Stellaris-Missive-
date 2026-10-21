"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OFFICE_SKIN_PAPER = exports.OFFICE_GLASS_TERM = exports.OFFICE_GLASS = exports.OFFICE_SKIN = exports.glassWin = exports.OFFICE_APPS = void 0;
exports.officePeople = officePeople;
exports.officeFeed = officeFeed;
exports.dockBounds = dockBounds;
const people_1 = require("./people");
exports.OFFICE_APPS = ['gov', 'fleet', 'vassal', 'press', 'speech', 'paper', 'terminal']; // terminal = 외교 통신 단말기(본 창)
/** 연락처: 모드의 지도자 명단(roster)이 있으면 그것으로 모두(통치자·총독·제독·장군·과학자·관료), 없으면 아는 인물(총독 목록·함대 사령부)만.
 *  총독 여부는 행성 목록의 총독 이름과 맞춰 정하고, 장군은 함대 사령부에 지상전 기록만 있는 지휘관. */
function officePeople(planets, admirals, roster = []) {
    const out = [];
    const govPlanet = new Map();
    for (const p of planets ?? []) {
        const g = (p.governor ?? '').trim();
        if (g && !govPlanet.has(g))
            govPlanet.set(g, p);
        else if (g && p.capital)
            govPlanet.set(g, p);
    }
    const adm = new Map(admirals.map((a) => [a.lid, a]));
    const live = roster.filter((r) => !r.gone);
    if (live.length) {
        const used = new Set();
        for (const r of live) {
            const a = adm.get(r.lid), ground = !!a && a.battles.length > 0 && a.battles.every((b) => b.type === 'ground');
            const gp = r.cls === 'official' ? govPlanet.get(r.name) : undefined;
            if (gp)
                used.add(r.name);
            const role = (0, people_1.contactRole)(r, !!gp, ground);
            const place = role === 'governor' ? gp.name : r.fleet ?? (a?.battles[a.battles.length - 1]?.sys ?? '');
            out.push({ key: 'p:' + r.lid, lid: r.lid, name: r.name, role, place, lv: r.lv, ...(r.council ? { council: true } : {}), ...(r.fleet ? { fleet: r.fleet } : {}), ...(r.traits && r.traits.length ? { traits: r.traits.slice() } : {}), ...(gp ? { planet: gp.name, ...(gp.capital ? { capital: true } : {}) } : {}), ...(a ? { status: a.status ?? 'none', battles: a.battles.length } : {}) });
        }
        for (const [g, p] of govPlanet)
            if (!used.has(g))
                out.push({ key: 'gov:' + p.name, name: g, role: 'governor', place: p.name, planet: p.name, ...(p.capital ? { capital: true } : {}) });
    }
    else {
        for (const p of planets ?? []) {
            const g = (p.governor ?? '').trim();
            if (!g)
                continue;
            out.push({ key: 'gov:' + p.name, name: g, role: 'governor', place: p.name, planet: p.name, ...(p.capital ? { capital: true } : {}) });
        }
        for (const a of admirals) {
            const ground = a.battles.length > 0 && a.battles.every((b) => b.type === 'ground');
            const last = a.battles[a.battles.length - 1];
            out.push({ key: 'adm:' + a.lid, lid: a.lid, name: a.name, role: ground ? 'general' : 'admiral', place: last?.sys ?? '', status: a.status ?? 'none', battles: a.battles.length });
        }
    }
    const order = { ruler: 0, governor: 1, admiral: 2, general: 3, scientist: 4, commander: 5, official: 6 };
    return out.sort((x, y) => order[x.role] - order[y.role] || Number(!!y.capital) - Number(!!x.capital) || (y.lv ?? 0) - (x.lv ?? 0) || x.name.localeCompare(y.name, 'ko'));
}
/** 바탕화면 오른쪽 "최근 소식": 우리 제국 연대기의 최근 n줄(새것 먼저). */
function officeFeed(groups, playerIdx, n = 6) {
    const mine = groups.find((g) => g.idx === playerIdx);
    return (mine?.items ?? []).slice(-n).reverse().map((e) => ({ date: e.date, text: e.text }));
}
/** 집무실 창 내용 영역 + 본문 자리 → 붙일 창의 화면 좌표. */
function dockBounds(content, r) {
    return { x: Math.round(content.x + r.x), y: Math.round(content.y + r.y), width: Math.max(320, Math.round(r.w)), height: Math.max(240, Math.round(r.h)) };
}
/** 집무실에서 새로 여는 창은 투명 창으로 만든다(배경만 비치고 글자는 그대로 선명). 창마다 BrowserWindow 옵션에 펼쳐 넣는다. */
const glassWin = (on) => (on ? { transparent: true, backgroundColor: '#00000000' } : {});
exports.glassWin = glassWin;
/** 붙은 창에 덧입히는 홀로그램 껍데기: 주사선, 창 끌기 막기(집무실 안에서 움직이지 않게). */
exports.OFFICE_SKIN = `*{-webkit-app-region:no-drag!important}
html::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:2147483647;background:repeating-linear-gradient(transparent 0 3px,color-mix(in srgb,var(--hi,#5fd4e4) 4%,transparent) 3px 4px);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--hi,#5fd4e4) 30%,transparent),inset 0 0 60px color-mix(in srgb,var(--hi,#5fd4e4) 10%,transparent)}`;
/** 투명 창에 덧입히는 유리 배경: 테마의 바탕·판 색만 반투명으로 바꾸고 글자·선·그림은 그대로 둔다. */
exports.OFFICE_GLASS = `
:root{--bg:rgba(4,20,28,.42)!important;--panel:rgba(8,32,44,.55)!important;--shade:rgba(8,32,44,.5)!important}
html,body{background-color:transparent!important}
html{background:linear-gradient(180deg,#06182473,#06252e4d 75%,#1354663d)!important}`;
/** 외교 통신 단말기(index.html)는 body 가 그라데이션(--bgfx)으로 칠해져 있어 그것까지 비운다. 집무실에서 떼면 이 CSS 는 지운다. */
exports.OFFICE_GLASS_TERM = exports.OFFICE_GLASS + `
:root{--bgfx:transparent!important;--cardbg:linear-gradient(160deg,rgba(15,47,64,.55),rgba(10,31,43,.45))!important;--inputbg:rgba(8,32,44,.6)!important}
body{background:transparent!important;border-color:transparent!important;box-shadow:none!important}
body:has(#drawer:not([hidden])) main{visibility:hidden!important}`; // 연락처·서신 서랍이 열리면 뒤 대화 화면이 유리로 비쳐 겹치지 않게
/** 집무실에서 연 신문은 디스플레이 지면으로 고정(2026-10-18)이라 바탕만 비운다. 예전의 글자 뒤집기는 종이 지면으로 바꾸면 글자가 사라져 없앴다. */
exports.OFFICE_SKIN_PAPER = `
html,body{background:transparent!important}
html{background:linear-gradient(180deg,#06182473,#06252e4d 75%,#1354663d)!important}
#paperbg{display:none!important}`;
//# sourceMappingURL=office.js.map