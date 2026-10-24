"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogRouter = exports.SLOT = void 0;
/** 2026-10-15 main.ts watcher 안의 원래 순서. 새 처리는 사이 번호를 쓴다. */
exports.SLOT = {
    STATS: 10, // 신호 수 세기·진단 기록
    HELLO: 20, // 연결 모드 정보, HELLO 응답 대기
    COMPAT_FEED: 30, // 모드 호환 팩에 모든 줄 전달
    ETHIC_END: 40, // 가치관 조회 끝
    COMPAT_EVENT: 50, // 호환 팩 사건 → 연대기·라디오
    CONTACT_BEGIN: 60, // 연락처 목록 시작(세이브 번호)
    TERMINAL: 70, // 연락처·단말기 응답
    LINE_DATE: 80, // 로그 줄 앞의 게임 날짜
    REQSEEN: 90, // 게임이 본 요청 번호 학습(game-link)
    OPSHIFT: 100, // 호감 변화
    ACK: 110, // 행동 결과(game-link)
    RESOLUTION: 120, // 은하 공동체 안건 알림
    AGENDA: 130, // 의회·라디오 사건(onAgendaSignal)
    PLANETS: 140, // 행성 목록
    MAIL: 150, // 서신·뉴스·제국 번호(onMailSignal)
    KEYBOARD: 160, // 게임 안 키보드 입력
    SPEECH_PF: 170, // 연설 프로필·상황
    SPEECH: 180, // 연설 준비·적용
    GOVTALK: 190, // 총독과 대화 결정
    END: 200, // 게임 안 창 대화 끝
    RESKEY: 210, // 안건 종류 알림
    LOADED: 220, // 세이브 불러옴(날짜·총독 기억 시간선)
    TALK: 230, // 대화 시작
    PROFILE: 240, // 상대 프로필
    GOVREPORT: 245, // 새해 총독 보고 요청(A-26)
    FEDERATION: 247, // 연방 읽기 FED·FEDMEMBER·FEDLAW·FEDEND(A-01 2단계)
    FACTION_MEET: 249, // 내정·파벌 회의 적용 확인(FACMEET) — 2026-10-16
    GAMESTATE: 248, // 월간 상황(STATE_*·WAR·FACTION·SPYNET·SUBJECT)·출신(ORIGIN)·첩보 작전(SPYOP) — 2026-10-16 초석
    FAVORS: 254, // 외교 대화 호의 정산 응답
    ARCHIVE: 258, // 대보관소 표본 읽기 ARCHIVE_BEGIN·ARCHIVE·ARCHIVE_EXH·ARCHIVE_END — 2026-10-17 알파 6
    GIFT: 255, // 만찬 자원 선물 창고 확인·전달 응답(GIFT) — 2026-10-17 알파 6
    PEACE: 256, // 평화 중재·강제 평화 MEDWAR·MEDSYS·MEDGIVE·끝 줄 — 2026-10-17
    SPY_APPLY: 257, // 첩보 대응 제재 적용 응답(SPYAPPLY) — 2026-10-17
    EFFECT_VERIFY: 253, // 개발자 효과 검증 응답
    DINNER: 252, // Dinner calendar and in-game reception receipts
    INBOX_SYNC: 250, // 서신함 동기화
    FLEET: 246, // 함대 사령부: BATTLE·BATTLESYS·BATTLEADM 전투 기록, ADMAPPLY·ADMEXPIRE 청문회 특성 — 2026-10-17
    VASSAL: 251, // 종속국 청원 결과 적용 응답(VASSALAPPLY) — 2026-10-17
    SECRETARY: 241, // 비서: 호출할 때 받는 최신 경제 수치(SPEECHCTX 응답 짝 맞추기) — 2026-10-18
    POLICY: 242, // 정책 퀘스트: 측정 POLICYM·POLICYC·POLICYO, 적용 POLICYAPPLY — 2026-10-18
    PEOPLE: 244, // 집무실 연락처: 내 지도자 명단 LEADER·LEADERAT·LEADER_END(매달) — 2026-10-18
    CRISIS: 243, // 은하 위기 감시 CRISIS·CRISIS_END(매달) → 신문·라디오 특별 편성 — 2026-10-17
    PETITION: 238, // 시민 청원 결정 적용 응답(PETITIONAPPLY) — 2026-10-19
    EMBASSY: 239, // 대사관 보고서 EMBFAC(파벌)·EMBASSY(끝 줄) — 2026-10-19
    PRESS: 259, // 언론사 인터뷰 준비·적용(PRESS)·월 신호로 준비 완료 — 2026-10-17
    CEREMONY: 237, // 출항 의식 군사 함대 조회
    OFFICIAL_HOLIDAYS: 232,
    ROOM_TROPHIES: 233, // Paid trophy receipt
    NATIONAL_EVENTS: 234, // National calendar and ceremony reward acknowledgements
    CONDEMN: 235, // 규탄 성명: WARVOICE·WARVOICE_END 제국별 관계 → 판정(2026-10-20 알파 10)
    DECLARE: 236, // 전쟁 선언문: EVT war_start → 알림(2026-10-20 알파 10)
    TO_UI: 260, // 화면에 원본 신호 전달(맨 끝)
    ALLY: 261, // 동맹 평의회: ALLY·ALLYTRAIT·ALLYEND·적용 ACK
};
class LogRouter {
    hs = [];
    /** slot 자리에 처리를 건다. 같은 자리는 한 번만. */
    on(slot, name, fn) {
        if (this.hs.some((h) => h.slot === slot))
            throw new Error(`log-router: 자리 ${slot} 이미 사용 중 (${name})`);
        this.hs.push({ slot, name, fn });
        this.hs.sort((a, b) => a.slot - b.slot);
    }
    dispatch(m) { for (const h of this.hs)
        h.fn(m); }
    /** 등록된 처리 이름(부르는 순서) — selftest·진단용 */
    names() { return this.hs.map((h) => `${h.slot}:${h.name}`); }
}
exports.LogRouter = LogRouter;
//# sourceMappingURL=log-router.js.map