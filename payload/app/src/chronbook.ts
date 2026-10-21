// 은하 연대기 책 내보내기(2026-10-17): 이 세이브·이 시간선의 연대기와 은하 뉴스를 해(年)별 장으로 엮어
// 한 장짜리 HTML 역사서를 만든다. 순수 함수만 둔다(파일 저장·PDF 변환은 features/chronbook-app.ts).
import { dateNum } from './gamedate';

export interface BookEntry { date: string; text: string; ruler?: string }
export interface BookGroup { idx: number; name: string; items: BookEntry[] }
export interface BookArticle { title: string; body: string; comment?: string; reporter?: string }
export interface BookIssue { date: string; headline: string; articles: BookArticle[]; briefs: string[]; extra?: boolean }
export interface BookInput { lang: 'ko' | 'en'; playerIdx: number; groups: BookGroup[]; issues: BookIssue[]; made: string }
export interface BookYear { year: string; mine: Array<BookEntry & { who: string }>; galaxy: Array<BookEntry & { who: string }>; issues: BookIssue[] }

export const BOOK_SKIP_IDX = 9990; // 성간 라디오 전용 연대기(1년만 남고 다른 기록과 겹친다)는 책에 넣지 않는다
export const BOOK_WORLD_IDX = 9999;

const esc = (s: string): string => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const yearOf = (d: string): string => { const m = /^(\d{3,5})/.exec(String(d || '').trim()); return m ? m[1] : ''; };
const byDate = (a: { date: string }, b: { date: string }): number => { const x = dateNum(a.date), y = dateNum(b.date); if (Number.isNaN(x) && Number.isNaN(y)) return 0; if (Number.isNaN(x)) return 1; if (Number.isNaN(y)) return -1; return x - y; };

/** 해별로 묶는다. 날짜가 없는 기록은 '연대 미상' 장('')으로 맨 뒤에 둔다. */
export function bookYears(inp: BookInput): BookYear[] {
  const ys = new Map<string, BookYear>();
  const get = (y: string): BookYear => { let v = ys.get(y); if (!v) ys.set(y, (v = { year: y, mine: [], galaxy: [], issues: [] })); return v; };
  for (const g of inp.groups) {
    if (g.idx === BOOK_SKIP_IDX) continue;
    const who = g.idx === BOOK_WORLD_IDX ? (inp.lang === 'en' ? 'Galactic news' : '세계 소식') : g.name;
    for (const e of g.items) { const row = { ...e, who }; (g.idx === inp.playerIdx ? get(yearOf(e.date)).mine : get(yearOf(e.date)).galaxy).push(row); }
  }
  for (const i of inp.issues) get(yearOf(i.date)).issues.push(i);
  const out = [...ys.values()];
  for (const y of out) { y.mine.sort(byDate); y.galaxy.sort(byDate); y.issues.sort(byDate); }
  return out.sort((a, b) => (a.year === '' ? 1 : b.year === '' ? -1 : Number(a.year) - Number(b.year)));
}

export function bookTitle(inp: BookInput): string {
  const me = inp.groups.find((g) => g.idx === inp.playerIdx)?.name;
  return inp.lang === 'en' ? (me ? `The Chronicle of ${me}` : 'A Galactic Chronicle') : (me ? `${me} 연대기` : '은하 연대기');
}

/** 책 전체 HTML(외부 자원 없이 한 파일). 기록이 하나도 없으면 null. */
export function buildBook(inp: BookInput): string | null {
  const years = bookYears(inp);
  if (!years.some((y) => y.mine.length || y.galaxy.length || y.issues.length)) return null;
  const en = inp.lang === 'en';
  const T = (ko: string, e: string): string => (en ? e : ko);
  const title = bookTitle(inp);
  const dated = years.filter((y) => y.year);
  const span = dated.length ? (dated.length > 1 ? `${dated[0].year} – ${dated[dated.length - 1].year}` : dated[0].year) : '';
  const yLabel = (y: string): string => (y ? (en ? `Year ${y}` : `${y}년`) : T('연대 미상', 'Undated'));
  const ch = (n: number): string => (en ? `Chapter ${n}` : `제${n}장`);
  const line = (e: BookEntry & { who: string }, showWho: boolean): string =>
    `<li><span class="d">${esc(e.date)}</span>${showWho ? `<span class="w">${esc(e.who)}</span>` : ''}${e.ruler ? `<span class="r">${esc(e.ruler)}</span>` : ''}${esc(e.text)}</li>`;
  const toc = years.map((y, i) => `<li><a href="#y${i}">${ch(i + 1)} · ${yLabel(y.year)}</a></li>`).join('');
  const body = years.map((y, i) => {
    const parts: string[] = [`<section class="chap" id="y${i}"><h2><small>${ch(i + 1)}</small>${yLabel(y.year)}</h2>`];
    if (y.mine.length) parts.push(`<h3>${T('우리 제국의 기록', 'Our Empire')}</h3><ul class="ev">${y.mine.map((e) => line(e, false)).join('')}</ul>`);
    if (y.galaxy.length) parts.push(`<h3>${T('은하의 움직임', 'Across the Galaxy')}</h3><ul class="ev">${y.galaxy.map((e) => line(e, true)).join('')}</ul>`);
    if (y.issues.length) {
      parts.push(`<h3>${T('그 해의 신문', 'Newspapers of the Year')}</h3>`);
      for (const is of y.issues) {
        parts.push(`<article class="paper"><div class="pd">${esc(is.date)}${is.extra ? ` · <b>${T('호외', 'Extra')}</b>` : ''}</div><h4>${esc(is.headline)}</h4>`);
        for (const a of is.articles) parts.push(`<div class="art"><h5>${esc(a.title)}</h5><p>${esc(a.body)}</p>${a.comment ? `<p class="cm">“${esc(a.comment)}”</p>` : ''}${a.reporter ? `<p class="rp">— ${esc(a.reporter)}</p>` : ''}</div>`);
        if (is.briefs.length) parts.push(`<ul class="br">${is.briefs.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`);
        parts.push('</article>');
      }
    }
    parts.push('</section>');
    return parts.join('');
  }).join('');
  return `<!doctype html><html lang="${en ? 'en' : 'ko'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
:root{--ink:#221d16;--mute:#6d6354;--rule:#cdbfa6;--bg:#f6f1e6;--acc:#7a4b1e}
@media (prefers-color-scheme:dark){:root{--ink:#e9e2d4;--mute:#a59a88;--rule:#4a4234;--bg:#1b1813;--acc:#d9a35f}}
@media print{:root{--ink:#000;--mute:#555;--rule:#bbb;--bg:#fff;--acc:#5a3510}.chap{break-before:page}.cover{break-after:page}a{color:inherit;text-decoration:none}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 "Noto Serif KR","Batang",Georgia,serif}
main{max-width:760px;margin:0 auto;padding:40px 16px 80px}
.cover{text-align:center;padding:12vh 0 8vh;border-bottom:2px solid var(--rule)}.cover h1{font-size:2.4em;margin:0 0 .2em;letter-spacing:.02em}.cover .sp{color:var(--acc);font-size:1.2em}.cover .mk{color:var(--mute);font-size:.85em;margin-top:2em}
nav h2{font-size:1.1em;color:var(--mute);margin-top:2em}nav ol{padding-left:1.2em}nav a{color:var(--ink)}
.chap{margin-top:3em}.chap h2{font-size:1.8em;border-bottom:1px solid var(--rule);padding-bottom:.2em}.chap h2 small{display:block;font-size:.5em;color:var(--acc);letter-spacing:.1em}
h3{font-size:1.05em;color:var(--acc);margin:1.6em 0 .4em}
.ev{list-style:none;padding:0;margin:0}.ev li{padding:.25em 0;border-bottom:1px dotted var(--rule)}.d{color:var(--mute);font-variant-numeric:tabular-nums;margin-right:.6em}.w{font-weight:bold;margin-right:.5em}.r{color:var(--mute);margin-right:.5em;font-style:italic}
.paper{border:1px solid var(--rule);padding:12px 16px;margin:.8em 0}.pd{color:var(--mute);font-size:.85em}.paper h4{font-size:1.3em;margin:.2em 0 .5em}.art h5{font-size:1em;margin:.8em 0 .2em}.art p{margin:.2em 0}.cm{font-style:italic;color:var(--mute)}.rp{text-align:right;color:var(--mute);font-size:.85em}.br{font-size:.9em;color:var(--mute)}
</style></head><body><main><header class="cover"><h1>${esc(title)}</h1>${span ? `<div class="sp">${esc(span)}</div>` : ''}<div class="mk">${esc(T('SLLM 연대기와 은하 뉴스에서 엮음', 'Compiled from the SLLM chronicle and Galactic News'))} · ${esc(inp.made)}</div></header>
<nav><h2>${T('차례', 'Contents')}</h2><ol>${toc}</ol></nav>${body}</main></body></html>`;
}
