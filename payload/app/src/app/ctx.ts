// A-00b 2번: 기능 모듈이 함께 쓰는 상태와 함수의 창구.
// 값은 아직 main.ts의 변수에 있고, main.ts가 시작할 때 bindCtx()로 읽기·쓰기 통로를 연결한다.
// 기능 모듈은 main.ts를 import하지 않고 ctx만 본다(순환 import 방지). 값은 모듈을 불러올 때가 아니라 쓸 때 읽어야 한다.
import type { BrowserWindow } from 'electron';
import type { Rect } from '../gameWindow';
import type { AiRouter } from '../aiclient';
import type { Player2Client } from '../player2';
import type { GovMemoryStore } from '../govmemory';
import type { ChronicleStore } from '../chronicle';
import type { FlagProvider } from '../flags';
import type { ModCompatibility } from '../mod-compat';
import type { TerminalContacts } from '../terminal-contacts';
import type { TalkContext, Profile } from '../prompt';
import type { MailCountry, News } from '../mail';
import type { SllmMessage } from '../protocol';
import type { LogWatcher } from '../logWatcher';
import type { SpeechPf } from '../speech';
import type { LoreStore } from '../lore';
import type { Action } from '../action';
import type { ChatMessage } from '../player2';

/** 토스트 알림 한 건(main.ts에서 옮김) */
export interface ToastMsg { kind: 'letter' | 'event' | 'info' | 'speech' | 'news' | 'gov' | 'faction' | 'mediation' | 'press' | 'vassal' | 'fleet' | 'office' | 'declare' | 'statement' | 'debate' | 'scandal' | 'hearing'; title: string; body: string; action?: string }

/** 수락 대기 제안(main.ts에서 옮김) */
export interface Pending { id: number; action: Action; tid: number; aiName: string; letterId?: number; letterSid?: string; /** 제안을 받은 연결 세대(세이브를 다시 불러오면 바뀐다) */ epoch?: number }

export interface AppCtx {
  /** 지금 불러온 세이브 번호(모드가 기록) */
  curSaveId: string;
  /** 게임 날짜(MONTH/YEAR 줄) */
  gameDate: string;
  /** 플레이어 제국 이름·모드 번호 */
  playerName: string;
  playerIdx: number;
  /** 게임이 켜져 있는지(게임 창 감시) */
  gameRunning: boolean;
  /** 게임 창 영역(DIP). 게임 창을 못 찾으면 null */
  readonly gameDip: Rect | null;
  /** 메인 창 */
  readonly win: BrowserWindow | null;
  /** 아이콘 창(런처) */
  readonly launcher: BrowserWindow | null;
  /** 화면 배율 */
  readonly curScale: number;
  /** 아이콘 창 기본 크기(배율 1) */
  readonly BASE_ICON: { width: number; height: number };
  iconBaseHeight(): number;
  /** LLM 호출(Player2 또는 개인 API) — 모든 기능이 이것 하나만 쓴다 */
  readonly ai: AiRouter;
  /** Player2 연결(로컬 앱) */
  readonly p2: Player2Client;
  /** Player2 상태 확인 시작·중지를 지금 설정에 맞춘다 */
  syncPlayer2Activity(): void;
  /** 총독 기억 저장소(시간선 분기 정보도 여기서) */
  govMem(): GovMemoryStore;
  /** 연대기 저장소 */
  chron(): ChronicleStore;
  /** 언론사 설정이 바뀔 때마다 올라가는 번호(라디오 대화 기록을 버릴지 판단) */
  readonly mediaRevision: number;
  /** 세이브·게임 파일에서 깃발·전기를 읽는 곳 */
  readonly flagProv: FlagProvider;
  /** 모드 호환 팩 */
  readonly modCompatibility: ModCompatibility;
  /** 통신 단말기 연락처 목록 */
  readonly terminal: TerminalContacts;
  terminalView(): unknown;
  /** 지금 대화 중인 상대 */
  talk: TalkContext | null;
  withLore<T extends { name: string; idx?: number; player?: string }>(t: T): T & { lore?: string; playerLore?: string; briefing?: string; chronicle?: string[]; galnews?: string[] };
  adoptedEthics(idx: number): { text: string; names: string[]; source: string };
  flagUrlFor(idx: unknown): string | null;
  /** 대화 중 쌓인 호감 변화·수락 대기 제안(있으면 경로를 못 바꾼다) */
  readonly pend: unknown;
  /** 플레이어가 수락해야 실행되는 제안(한 번에 하나) */
  pending: Pending | null;
  pendingSeq: number;
  /** 지금 대화의 기록(LLM 메시지) */
  readonly history: ChatMessage[];
  /** 마지막 AI 대사(게임 안 창에 띄울 문장) */
  lastSay: string;
  /** 편지 답장을 연결 중인지(서신 모듈) */
  readonly mailReplyBusy: boolean;
  /** 경로 설정을 로그 감시·깃발 읽기에 적용 */
  applyEnvironment(): void;
  imageState(): unknown;
  /** 연결 모드 폴더(기본 초상화·행성 배경 사진이 있는 곳) */
  readonly MOD_DIR: string;
  /** 게임 로그 파일 경로 */
  readonly GAME_LOG: string;
  /** 게임 창이 맨 앞인지 */
  readonly gameFront: boolean;
  /** 진단: 종류별 게임 신호 수, 마지막 신호 */
  readonly gameSignalCounts: Record<string, number>;
  readonly lastGameSignal: unknown;
  /** game.log 감시기 */
  readonly watcher: LogWatcher;
  /** 제국 번호별 마지막 프로필, 서신 후보 제국 */
  readonly profiles: Map<number, Profile>;
  readonly mailCountries: Map<number, MailCountry>;
  /** 최근 세계 사건(서신·소문 재료, 2년) */
  readonly news: News[];
  /** 토스트 알림 */
  notify(msg: ToastMsg): void;
  /** 서신함 상태 줄 */
  mailNote(text: string): void;
  /** 설정 창 */
  readonly setWin: BrowserWindow | null;
  /** (지금은 안내만) 대화 전에 게임을 멈추라고 권한다 */
  needPaused(): void;
  /** 트레이 메뉴 다시 만들기(안건 상태가 바뀔 때) */
  refreshTray(): void;
  /** 프로필에 모드 가치관 설명을 덧붙인다 */
  profileWithEthics(pr: Profile | undefined, idx: number): Profile | undefined;
  /** 제국 배경 설명(게임·모드 파일) */
  readonly loreStore: LoreStore;
  /** 아이콘 창의 안 읽은 편지 수 갱신 */
  updateBadge(): void;
  /** 게임 달 신호(진행 중 표시) */
  onMonthTick(): void;
  /** 본 창(대화 화면)이 열려 있는지 */
  readonly appOpen: boolean;
  /** 앱 창 열기/접기(아이콘으로) */
  setAppOpen(v: boolean): void;
  /** 이 국가 유형에 게임 행동(에너지·국경 등)을 허용하는지(호환 설정) */
  actionsAllowed(idx: number): boolean;
  /** 연설 프로필에 모드 가치관을 덧붙인다 */
  speechWithEthics(pf: SpeechPf | null): SpeechPf | null;
  /** 제국 가치관을 게임에서 다시 읽는다 */
  refreshEthics(idx: number): Promise<void>;
  /** 단말기 명령을 보내고 끝 줄(end:req)을 기다린다 */
  terminalRequest(effect: string, end: string, req: number): Promise<SllmMessage>;
  /** 메인 창(과 총독 창)에 이벤트 보내기 */
  toUi(channel: string, payload: unknown): void;
}

export const ctx = {} as AppCtx;

type Binding<T> = { [K in keyof T]?: { get: () => T[K]; set?: (v: T[K]) => void } | T[K] };
/** main.ts가 한 번 부른다. 함수는 그대로, 변수는 get/set 쌍으로 넘긴다. */
export function bindCtx(b: Binding<AppCtx>): void {
  for (const [k, v] of Object.entries(b)) {
    const isBinding = !!v && Object.getPrototypeOf(v) === Object.prototype && typeof (v as { get?: unknown }).get === 'function'; // Map 같은 객체는 값으로 넘긴다(Map 에도 get 이 있다)
    if (isBinding) Object.defineProperty(ctx, k, { get: (v as any).get, set: (v as any).set, enumerable: true, configurable: true });
    else Object.defineProperty(ctx, k, { value: v, enumerable: true, configurable: true, writable: false });
  }
}
