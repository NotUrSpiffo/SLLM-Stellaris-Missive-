import { logDiagnostic } from './diagnostics';
// 제국 깃발 공급자: 최근 세이브 + 게임 폴더 이미지로 모드 번호(sllm_idx) -> 깃발 PNG 데이터 주소를 만든다.
import * as fs from 'fs';
import * as path from 'path';
import { gameCandidates } from './environment-paths';
import { findLatestSave, readSaveFlags, type SaveFlags, type PortraitInfo } from './savereader';
import { ModResources } from './mod-resources';
import { composeFlag, decodeDds, encodePng, parseColors } from './flagrender';
import { L } from './i18n-pick'; // 한/영 문구(2026-10-19 영어 화면 점검)

export function isGameDir(d: string): boolean { try { return fs.existsSync(path.join(d, 'flags', 'colors.txt')); } catch { return false; } }

/** 스팀 라이브러리 목록(libraryfolders.vdf)에서 스텔라리스 설치 폴더를 찾는다. SLLM_GAME_DIR 로 직접 지정할 수도 있다. */
export function findGameDir(): string | null {
  const cand = gameCandidates();
  for (const c of cand) { try { if (fs.existsSync(path.join(c, 'flags', 'colors.txt'))) return c; } catch { /* 건너뜀 */ } }
  return null;
}

export class FlagProvider {
  private resources: ModResources | null = null;
  private resourceRevision = -1;
  private expectedSid = '';
  private report = new Map<number, unknown>();
  useResources(resources: ModResources): void { this.resources=resources; this.cache.clear(); this.colors=null; }
  setExpectedSid(sid: string): void { this.expectedSid=sid; this.cache.clear(); this.report.clear(); this.lastScan = 0; }
  private matchesSave(): boolean { return !this.expectedSid || this.save?.data.sid === this.expectedSid; }
  ethicsFor(idx: number): string[] | null { this.refresh(); return this.matchesSave() ? this.save?.data.ethicsByIdx?.[String(idx)] ?? null : null; }
  portraitInfoFor(idx: number): PortraitInfo | null { this.refresh(); return this.matchesSave() ? this.save?.data.portraitsByIdx?.[String(idx)] ?? null : null; }
  /** 통치자의 초상화 ID·성별(세이브 기준). 모르면 null. */
  rulerFor(idx: number): import('./savereader').RulerInfo | null { this.refresh(); return this.matchesSave() ? this.save?.data.rulerByIdx?.[String(idx)] ?? null : null; }
  typeFor(idx: number): string { this.refresh(); return this.matchesSave() ? this.save?.data.typesByIdx?.[String(idx)] || '' : ''; }
  diagnostics() { this.refresh(); return {file:this.save?.file||null,date:this.save?.data.date||'',sid:this.save?.data.sid||'',expectedSid:this.expectedSid,matches:this.matchesSave(),flags:[...this.report].map(([idx,result])=>({idx,result}))}; }
  private gameDir: string | null | undefined;
  private colors: Record<string, [number, number, number]> | null = null;
  private save: { file: string; mtime: number; data: SaveFlags } | null = null;
  /** 읽기에 실패한 세이브(같은 파일·같은 수정 시각이면 다시 풀지 않는다. 게임이 저장을 마치면 시각이 바뀌어 다시 읽는다, 2026-10-18) */
  private failed: { file: string; mtime: number; at: number } | null = null;
  /** 마지막으로 세이브 폴더를 훑은 시각. 깃발·초상화 접근자가 한 화면에서 수십 번 불려도 폴더 전체 stat 은 1.5초에 한 번만(2026-10-18). */
  private lastScan = 0;
  private cache = new Map<string, string>();

  private userSaveDir: string | null = null;
  private userGameDir: string | null = null;
  constructor(private roots?: string[]) {}

  /** 설정에서 직접 고른 폴더(없으면 null = 자동 찾기). */
  configure(o: { saveDir?: string | null; gameDir?: string | null; roots?: string[] }): void {
    if (o.roots) this.roots = o.roots;
    this.userSaveDir = o.saveDir || null; this.userGameDir = o.gameDir || null;
    this.gameDir = undefined; this.colors = null; this.save = null; this.failed = null; this.lastScan = 0; this.cache.clear(); this.resources?.invalidate(); this.report.clear();
  }
  latestSave(): string | null { return findLatestSave(this.userSaveDir ? [this.userSaveDir] : this.roots); }
  game(): string | null { return this.userGameDir && isGameDir(this.userGameDir) ? this.userGameDir : findGameDir(); }

  /** 가장 최근 세이브를 다시 읽을지 정한다(바뀐 경우만). */
  refresh(): void {
    const now = Date.now();
    if (this.save && now - this.lastScan < 1500) return;
    this.lastScan = now;
    const f = this.latestSave();
    if (!f) return;
    let mt = 0;
    try { mt = fs.statSync(f).mtimeMs; } catch { return; }
    if (this.save && this.save.file === f && this.save.mtime === mt) return;
    if (this.failed && this.failed.file === f && this.failed.mtime === mt && now - this.failed.at < 30000) return; // 일시적 잠금(EBUSY 등)일 수 있어 30초 뒤엔 다시 시도
    try {
      const data = readSaveFlags(f);
      if (data) { this.save = { file: f, mtime: mt, data }; this.cache.clear(); this.failed = null; }
      else this.failed = { file: f, mtime: mt, at: now };
    } catch(error) { this.failed = { file: f, mtime: mt, at: now }; logDiagnostic('warn','save.read_failed',{file:f,error}); }
  }

  /** 가장 최근 세이브의 게임 날짜(없으면 빈 문자열). */
  latestDate(): string { this.refresh(); return this.save?.data.date ?? ''; }

  /** 모드 번호(sllm_idx) 제국의 국력(세이브 기준). 모르면 null. */
  statsFor(idx: number): import('./savereader').CountryStats | null {
    this.refresh();
    return this.matchesSave() ? this.save?.data.statsByIdx[String(idx)] ?? null : null;
  }

  /** 모드 번호(sllm_idx) 제국의 전기(세이브의 건국 종족 정보). 커스텀 제국이 아니면 null. */
  bioFor(idx: number): string | null {
    this.refresh();
    return this.matchesSave() ? this.save?.data.bioByIdx[String(idx)] ?? null : null;
  }

  /** Office heraldry: alpha-only emblem, without flag background or empire colors. */
  emblemFor(idx: number): string | null {
    if (!Number.isInteger(idx) || idx < 0) return null;
    this.refresh();
    if (!this.matchesSave()) return null;
    this.resources?.refresh();
    if (this.resources && this.resourceRevision !== this.resources.revision) {
      this.resourceRevision = this.resources.revision; this.colors = null; this.cache.clear();
    }
    const spec = this.save?.data.byIdx[String(idx)];
    if (!spec) return null;
    const key = 'office-emblem:' + JSON.stringify(spec);
    const cached = this.cache.get(key); if (cached) return cached;
    try {
      let bytes: Buffer;
      if (this.resources) {
        const resource = this.resources.resolve('flags/' + spec.iconCat + '/' + spec.iconFile);
        if (!resource) return null;
        bytes = this.resources.read(resource);
      } else {
        const game = this.game(); if (!game) return null;
        const base = path.resolve(game, 'flags');
        const target = path.resolve(base, spec.iconCat, spec.iconFile);
        if (!target.startsWith(base + path.sep)) return null;
        bytes = fs.readFileSync(target);
      }
      const image = decodeDds(bytes); if (!image) return null;
      // Preserve original alpha and cutouts; monochrome tint is applied by CSS.
      const px = new Uint8Array(image.px);
      for (let i = 0; i < px.length; i += 4) { px[i] = 255; px[i + 1] = 255; px[i + 2] = 255; }
      const url = 'data:image/png;base64,' + encodePng({w: image.w, h: image.h, px}).toString('base64');
      this.cache.set(key, url); return url;
    } catch { return null; }
  }

  /** 모드 번호(sllm_idx)의 깃발. 모르면 null. */
  urlFor(idx: number): string | null {
    this.refresh();
    if (!this.matchesSave()) { this.report.set(idx,{error:L('최근 세이브가 현재 플레이와 다릅니다. 현재 게임을 저장해 주세요.', 'The latest save does not match the current game. Please save the current game.')}); return null; }
    this.resources?.refresh();
    if (this.resources && this.resourceRevision !== this.resources.revision) { this.resourceRevision=this.resources.revision; this.colors=null; this.cache.clear(); }
    const spec = this.save?.data.byIdx[String(idx)];
    if (!spec) { this.report.set(idx,{error:L('세이브에서 깃발 구성을 찾지 못했습니다.', 'Could not find the flag layout in the save.')}); return null; }
    const key = JSON.stringify(spec);
    const hit = this.cache.get(key);
    if (hit) return hit;
    if (this.gameDir === undefined) this.gameDir = this.game();
    if (!this.gameDir) return null;
    if (this.resources) {
      if (!this.colors) { this.colors={}; for(const f of this.resources.files('flags','.txt')) { try { Object.assign(this.colors,parseColors(this.resources.read(f).toString('utf8'))); } catch { /* diagnostics below */ } } }
      const layers: unknown[]=[];
      const img=composeFlag(spec,this.gameDir,this.colors,{size:96,load:(category,file)=>{
        const f=this.resources!.resolve('flags/'+category+'/'+file);
        if(!f){layers.push({category,file,error:L('파일 누락', 'File missing')});return null;}
        try { const image=decodeDds(this.resources!.read(f)); layers.push({category,file,source:f.source,mod:f.root.name,...(!image?{error:L('지원하지 않거나 손상된 DDS', 'Unsupported or corrupted DDS')}:{})});return image; }
        catch(e){layers.push({category,file,source:f.source,error:(e as Error).message});return null;}
      }});
      this.report.set(idx,{spec,layers,missingColors:spec.colors.filter(c=>c!=='null'&&!this.colors![c]),partial:layers.some((x:any)=>x.error)});
      if(!img)return null;
      const url='data:image/png;base64,'+encodePng(img).toString('base64');this.cache.set(key,url);return url;
    }
    if (!this.colors) {
      try { this.colors = parseColors(fs.readFileSync(path.join(this.gameDir, 'flags', 'colors.txt'), 'utf8')); } catch { return null; }
    }
    const img = composeFlag(spec, this.gameDir, this.colors, { size: 96 });
    if (!img) return null;
    const url = 'data:image/png;base64,' + encodePng(img).toString('base64');
    this.cache.set(key, url);
    return url;
  }
}
