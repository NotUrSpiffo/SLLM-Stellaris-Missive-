// 집무실(2026-10-18) 순수 도우미: 연락처에 올릴 인물 목록과 바탕화면 소식 줄.
import type { Planet } from './planets';
import { contactRole, type LeaderClass } from './people';

export const OFFICE_APPS = ['gov', 'fleet', 'vassal', 'press', 'speech', 'paper', 'terminal'] as const; // terminal = 외교 통신 단말기(본 창)
export type OfficeApp = typeof OFFICE_APPS[number];

export type PersonRole = 'ruler' | 'governor' | 'admiral' | 'general' | 'scientist' | 'commander' | 'official';
export interface OfficePerson { key: string; name: string; role: PersonRole; place: string; planet?: string; capital?: boolean; status?: string; battles?: number; lid?: number; lv?: number; council?: boolean; fleet?: string; traits?: string[]; traitNotes?: string[] } // traits: 특성 키(office-app 이 이름으로 바꿈)
type Adm = { lid: number; name: string; status?: string; battles: Array<{ type?: string; sys?: string }> };
type Roster = Array<{ lid: number; name: string; cls: LeaderClass; lv: number; ruler: boolean; council: boolean; fleet?: string; gone?: string; traits?: string[] }>;

/** 연락처: 모드의 지도자 명단(roster)이 있으면 그것으로 모두(통치자·총독·제독·장군·과학자·관료), 없으면 아는 인물(총독 목록·함대 사령부)만.
 *  총독 여부는 행성 목록의 총독 이름과 맞춰 정하고, 장군은 함대 사령부에 지상전 기록만 있는 지휘관. */
export function officePeople(planets: Planet[] | null, admirals: Adm[], roster: Roster = []): OfficePerson[] {
  const out: OfficePerson[] = [];
  const govPlanet = new Map<string, Planet>();
  for (const p of planets ?? []) { const g = (p.governor ?? '').trim(); if (g && !govPlanet.has(g)) govPlanet.set(g, p); else if (g && p.capital) govPlanet.set(g, p); }
  const adm = new Map(admirals.map((a) => [a.lid, a]));
  const live = roster.filter((r) => !r.gone);
  if (live.length) {
    const used = new Set<string>();
    for (const r of live) {
      const a = adm.get(r.lid), ground = !!a && a.battles.length > 0 && a.battles.every((b) => b.type === 'ground');
      const gp = r.cls === 'official' ? govPlanet.get(r.name) : undefined; if (gp) used.add(r.name);
      const role = contactRole(r, !!gp, ground);
      const place = role === 'governor' ? gp!.name : r.fleet ?? (a?.battles[a.battles.length - 1]?.sys ?? '');
      out.push({ key: 'p:' + r.lid, lid: r.lid, name: r.name, role, place, lv: r.lv, ...(r.council ? { council: true } : {}), ...(r.fleet ? { fleet: r.fleet } : {}), ...(r.traits && r.traits.length ? { traits: r.traits.slice() } : {}), ...(gp ? { planet: gp.name, ...(gp.capital ? { capital: true } : {}) } : {}), ...(a ? { status: a.status ?? 'none', battles: a.battles.length } : {}) });
    }
    for (const [g, p] of govPlanet) if (!used.has(g)) out.push({ key: 'gov:' + p.name, name: g, role: 'governor', place: p.name, planet: p.name, ...(p.capital ? { capital: true } : {}) });
  } else {
    for (const p of planets ?? []) {
      const g = (p.governor ?? '').trim(); if (!g) continue;
      out.push({ key: 'gov:' + p.name, name: g, role: 'governor', place: p.name, planet: p.name, ...(p.capital ? { capital: true } : {}) });
    }
    for (const a of admirals) {
      const ground = a.battles.length > 0 && a.battles.every((b) => b.type === 'ground');
      const last = a.battles[a.battles.length - 1];
      out.push({ key: 'adm:' + a.lid, lid: a.lid, name: a.name, role: ground ? 'general' : 'admiral', place: last?.sys ?? '', status: a.status ?? 'none', battles: a.battles.length });
    }
  }
  const order: Record<PersonRole, number> = { ruler: 0, governor: 1, admiral: 2, general: 3, scientist: 4, commander: 5, official: 6 };
  return out.sort((x, y) => order[x.role] - order[y.role] || Number(!!y.capital) - Number(!!x.capital) || (y.lv ?? 0) - (x.lv ?? 0) || x.name.localeCompare(y.name, 'ko'));
}

/** 바탕화면 오른쪽 "최근 소식": 우리 제국 연대기의 최근 n줄(새것 먼저). */
export function officeFeed(groups: Array<{ idx: number; items: Array<{ date: string; text: string }> }>, playerIdx: number, n = 6): Array<{ date: string; text: string }> {
  const mine = groups.find((g) => g.idx === playerIdx);
  return (mine?.items ?? []).slice(-n).reverse().map((e) => ({ date: e.date, text: e.text }));
}

/** 홀로그램 본문 자리(집무실 창 안 CSS 픽셀). */
export interface OfficeRect { x: number; y: number; w: number; h: number }
/** 집무실 창 내용 영역 + 본문 자리 → 붙일 창의 화면 좌표. */
export function dockBounds(content: { x: number; y: number }, r: OfficeRect): { x: number; y: number; width: number; height: number } {
  return { x: Math.round(content.x + r.x), y: Math.round(content.y + r.y), width: Math.max(320, Math.round(r.w)), height: Math.max(240, Math.round(r.h)) };
}
/** 집무실에서 새로 여는 창은 투명 창으로 만든다(배경만 비치고 글자는 그대로 선명). 창마다 BrowserWindow 옵션에 펼쳐 넣는다. */
export const glassWin = (on?: boolean): { transparent?: boolean; backgroundColor?: string } => (on ? { transparent: true, backgroundColor: '#00000000' } : {});
/** 붙은 창에 덧입히는 홀로그램 껍데기: 주사선, 창 끌기 막기(집무실 안에서 움직이지 않게). */
export const OFFICE_SKIN = `*{-webkit-app-region:no-drag!important}
html::after{content:"";position:fixed;inset:0;pointer-events:none;z-index:2147483647;background:repeating-linear-gradient(transparent 0 3px,color-mix(in srgb,var(--hi,#5fd4e4) 4%,transparent) 3px 4px);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--hi,#5fd4e4) 30%,transparent),inset 0 0 60px color-mix(in srgb,var(--hi,#5fd4e4) 10%,transparent)}`;
/** 투명 창에 덧입히는 유리 배경: 테마의 바탕·판 색만 반투명으로 바꾸고 글자·선·그림은 그대로 둔다. */
export const OFFICE_GLASS = `
:root{--bg:rgba(4,20,28,.42)!important;--panel:rgba(8,32,44,.55)!important;--shade:rgba(8,32,44,.5)!important}
html,body{background-color:transparent!important}
html{background:linear-gradient(180deg,#06182473,#06252e4d 75%,#1354663d)!important}`;
/** 외교 통신 단말기(index.html)는 body 가 그라데이션(--bgfx)으로 칠해져 있어 그것까지 비운다. 집무실에서 떼면 이 CSS 는 지운다. */
export const OFFICE_GLASS_TERM = OFFICE_GLASS + `
:root{--bgfx:transparent!important;--cardbg:linear-gradient(160deg,rgba(15,47,64,.55),rgba(10,31,43,.45))!important;--inputbg:rgba(8,32,44,.6)!important}
body{background:transparent!important;border-color:transparent!important;box-shadow:none!important}
body:has(#drawer:not([hidden])) main{visibility:hidden!important}`; // 연락처·서신 서랍이 열리면 뒤 대화 화면이 유리로 비쳐 겹치지 않게
/** 집무실에서 연 신문은 디스플레이 지면으로 고정(2026-10-18)이라 바탕만 비운다. 예전의 글자 뒤집기는 종이 지면으로 바꾸면 글자가 사라져 없앴다. */
export const OFFICE_SKIN_PAPER = `
html,body{background:transparent!important}
html{background:linear-gradient(180deg,#06182473,#06252e4d 75%,#1354663d)!important}
#paperbg{display:none!important}`;
