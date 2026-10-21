# 알파 6 준비 정리 — 2026-10-17 저녁

기준: CURRENT_TASKS_KO.md(10/17 알파 5.1 긴급 배포까지), RELEASE_ALPHA51_KO.md, HANDOFF_KO.md, 오늘 저녁 포트레이트 라이브러리 작업. "구현됨"과 "게임에서 확인됨"을 구분한다. 알파 5.1까지 쌓인 기능 대부분은 게임 안 동작을 아직 한 번도 검수하지 않았다.

## 0. 지금 상태 한 줄 (2026-10-18 새벽 갱신)

- **알파 6 빌드 직전 단계 완료.** 남은 것은 사용자가 `설치기_만들기.bat` 실행 → 창작마당 업로드 → 게임 검수(§2).
- 버전 0.1.0-alpha.6 로 올림(package.json·lock·tester-mod descriptor·HELLO·setup.nsi, 실행 앱·payload·문서\mod 두 폴더). 연결 규격 5.
- 실행 앱 = payload(파일별 크기 일치 확인), 격리 빌드 tsc 통과, 자동 검사 PASS 1507 / FAIL 1(예시 그림 폴더 없는 환경 1건).
- 창작마당 폴더 `dist/workshop_0.1.0-alpha.6/sllm_missive`(109개) + 변경 글, 업로드 원본 `문서\mod\sllm_missive` 도 같은 내용·버전.
- 기록: RELEASE_ALPHA6_KO.md, CURRENT_TASKS_KO.md 최상단.

## 1. 알파 6 에 들어갈 것 (사용자 확정)

| # | 항목 | 지금 상태 | 남은 일 |
| --- | --- | --- | --- |
| 1 | 신문 3기사 + 기사 끝 의견 한 문장 | 구현·5.1 포함 | 게임 안에서 실제 발행 확인 |
| 2 | 호외(속보) 토글, 연 1회 상한(설정으로 증가), AI는 헤드라인 한 줄만, 나머지 더미 글씨, 읽지 않음 배지 | 구현·5.1 포함(이전 "미구현" 표시는 폐기) | 게임 안 확인, 상한 기본값 재확인 |
| 3 | 라디오 후속 보도(연속 보도는 라디오가 맡음, recapFacts 로 추가 호출 없음, 라디오 연대기 ⊇ 신문 연대기) | 구현(10/17 밤) | 게임 안 확인 |
| 4 | 경제 사정 대화(`ec=` 5자리, 지도자가 부족 자원 말함) | 구현·5.1 포함 | 게임 안 확인 |
| 5 | 자원 부족 지원 선물: 만찬에서 부족분 지원 → 호의 +1(만찬당 1회, 여러 요구라도 1회, 총합 상한 5 유지) | 미구현 | 만찬 이벤트에 선물 선택지 + 앱 호의 처리 |
| 6 | 만찬 수집품(Grand Archive 표본) | 미구현 | 1단계 `SLLM:ARCHIVE` 로그·앱 표시(표본 한글 현지화 키 확인) → 2단계 선물(`can_give_specimen`→`give_specimen`→주는 쪽 `remove_specimen`, 희귀도별 호감) → 3단계 지도자 역요구(수락/거절 호감·불만, `steal_specimens` 안 씀) |
| 7 | SLLM 자체 버프 라이브러리(`tools/gen-buffs.py`, 99항목·630수정자) | 생성 완료 | 용도 확정(10/17): 앞으로 기능의 버프 보상을 만들 때 꺼내 쓰는 재료 창고. 알파 6 에서 따로 연결할 일 없음 |
| 8 | 포트레이트 라이브러리(오늘) | 코드·pak 반영, 자동 검사 32개 통과, 실행 미확인 | §3 참고 |

알파 6 이후로 미룬 것: 기계/군체 대체 회의·호감 규칙, 만찬 중 심층 외교 결과(보류 해제 조건: 게임 정의 확인), 증권거래소(GSM) 뉴스 연동(애드온), 다른 모드 자동 인식.

## 2. 알파 6 전에 반드시 할 게임 안 검수 (알파 4~5.1 누적 미검수)

한 번의 인게임 세션에서 묶어서 확인. 10/16 1차 플레이는 SLLM 미적용 상태였으므로 실질 검수 0건.

연결·기본
- dlc_load.json 에 sllm 모드 켜져 있음, game.log 에 SLLM HELLO/LOADED/IDX/CONTACT, 앱 연결 준비 표시.
- 중복 등록(로컬 sllm_missive.mod ↔ ugc_3819625112.mod) 재발 여부. 로컬 등록은 비활성 유지.
- F-46 같은 실행에서 메인 메뉴 복귀 후 명령 차단·재연결(크래시 없음).

모드 스크립트(error.log 에 sllm 오류 0건이 1차 기준)
- 월간 수집 `sllm_probe_state_scan`: STATE_*/COUNCILAG(eth 포함)/SPYNET 값이 숫자로 나오는지, 성능.
- 연설: F-38 교체 수정자(country_*_produces_mult 5종) 실제 적용, SPEECHCTX(SPEECHWAR·원시값) 생산.
- 파벌 회의: 실제 의제 8개 `set_council_agenda` 성공 여부, 쿨다운(10800일) 중 설정 가능 여부, `faction_approval`·파벌 범위 `add_modifier`, 강제 통과 디버프.
- 평화 중재: MEDWAR 목록, MEDSYS 점령·영유권, MEDGIVE 적용(set_owner·end_war_effect·set_truce) → MEDAPPLY_END. 강제 평화 같은 경로.
- 첩보: 수정자 6종(sllm_spy_output_1~3, sllm_spy_opinion_1~3) 적용·기간 720일, 효과 검증기 목록.
- 연방: `sllm_probe_fed_war`(회장 declare_war → SLLM:FEDWAR), 가입 세이브에서 FED/FEDMEMBER/FEDLAW 값.
- 정체: CONTACT/PROFILE 의 gest(0/1/2) → 기계 지성/군집 의식 표시, 군집·기계 플레이어 파벌 회의 거절, 전용 말투, 만찬 mode.
- 지도자 초대: 도착 이벤트 표시·에너지 차감(1000/100/0), 3~6개월 답장, 6개월 방문 예약.
- 라디오 F-37: EVT→연대기→라디오. F-42 진행 중 안건 복구·중복 알림 없음. F-43 prev 범위 양방향 호감.
- 신문: 3기사·의견·`ec=` 경제 기사·호외·영어 UI.
- 해마다 중재 제안 알림(확률식) 1회 이상 관측.

앱
- `npm test` 기준선: 5.1 = PASS 1102 / FAIL 4(경로 환경 차이). 오늘 +32 → 새 실패 0 이어야 함.
- 영어 UI 전환 상태로 위 화면 한 번씩(알파3 이후 기능은 영어도 같이 봄).

검수 결과는 docs/LIVE_VALIDATION_*.md 형식으로 기록하고, 통과하지 않은 항목은 "구현됨·미검수"로 남긴다.

## 3. 포트레이트 라이브러리 — 남은 일

실기 확인
- `app\SLLM-Tester\start_app.bat` → 컴파일 통과. 첫 실행에 `portrait-library.pak`(6.5MB, 앱 폴더) 이 앱 데이터 `portrait_library\` 로 풀리는지(567파일, `.pak-stamp`).
- 설정 > 그림 "포트레이트 라이브러리" 칸: 계열/옷/적용 대상(제국·종족·계열·의원·플레이어 통치자) 동작, 영어 전환.
- 대화 상대: 세이브 통치자에 맞는 자동 그림, 상태 문구 "라이브러리 자동 선택". 직접 올린 그림이 있으면 그것이 먼저.
- 은하 의회: 의석마다 남녀 섞인 얼굴, 외계인 혐오 제국은 통치자 종족 모델만. 사용자가 올린 delegate/class 그림이 있으면 예전 방식 유지.
- 실제 세이브(2204.03.06)에서 통치자 41/46, 연락처 15/16 매칭 확인됨(오프라인).

갭(결정 필요)
- 라이브러리에 없는 것: 로봇 일부(sd_*), mindwarden·shroudwalker·salvager 등 특수, 인간 신체 변형(new_human) 1쌍만. 채울지, 기본 계열 그림으로 둘지.
- 옷: 통치자/총독/제독/장군/과학자만. 의원은 총독→통치자 순.
- 기존 체크리스트 "빠진 계열 그림 7종 사용자 제공 대기"는 라이브러리로 상당 부분 대체 가능 — 어느 계열이 비는지 다시 세어 결정.

배포 시 챙길 것
- 새 파일: `src/portraitlib.ts`, `src/features/portrait-lib-app.ts`, `ui/delegate-pick.js`, `portrait-library.pak` → 설치기 빌드가 uninstall-files.nsh 재생성(손으로 안 고침). 평화 중재 모드 파일 5개도 같은 확인.
- 창작마당 모드는 변경 없음(라이브러리는 앱 쪽).

## 4. 알파 6 배포 절차 체크 (RELEASE_RULES_KO.md 그대로)

1. `app\SLLM-Tester` == `payload\app` 확인(node_modules·manage-dll.ps1·register-mod.ps1·tester-registration.json 제외).
2. `tsc` 통과, `npm test` 새 실패 0.
3. 버전 올리기: package.json·package-lock.json, tester-mod/descriptor.mod, sllm_probe_connection.txt HELLO version, installer/setup.nsi APP_VERSION, README_KO·ALPHA_SETUP_*·RELEASE_NOTES_*(한/영).
4. 모드가 바뀌었으면 연결 규격 번호(지금 4) 올릴지 결정.
5. 빌드: Windows `build-installer.ps1`(NSIS 필요) 또는 VM `build-release.sh`. uninstall-files.nsh 자동 재생성.
6. 결과 `dist/SLLM-Missive-Tester-Setup-<버전>.exe` + 새 폴더에 한 부. 창작마당 폴더 `dist/workshop_<버전>/sllm_missive` + 문서\mod\sllm_missive 갱신(업로드는 사용자).
7. 기록: RELEASE_ALPHA6_KO.md(크기·SHA256·검사 수·미검수 항목 명시), CURRENT_TASKS_KO.md 갱신.

## 5. 사용자 결정 (2026-10-17 밤 확정)

- 연결 규격 4→5: **올림**. 모드 `sllm_probe_connection.txt` HELLO 를 protocol=5 로 바꿔 payload·실행 앱 tester-mod·문서\mod\sllm_missive_tester·sllm_missive 에 반영(버전 문자열은 설치기 도구가 알파 6 으로 올림). 앱 쪽은 지금 번호를 기록만 하고 비교하지 않음 → 구버전 모드 경고는 아직 없음(필요하면 추가).
- 선물 이벤트: 현재 구현 확정(자원·양은 플레이어가 카드에서 정함, 부족 자원 100 이상 → 만찬당 호의 +1). 문턱·배분은 추후 조정.
- 수집품 희귀도별 호감: 현재 값 확정(common +1 / rare +1·의견 작게 / epic +2 / exceptional +2·의견 크게, 요구받은 표본은 한 단계 위, 물질주의 거절 신뢰 −30). 추후 조정.
- 호외: 연 1회 기본값 유지(설정에서 상한 증가). 토큰 낭비가 사용자에게 더 큼.
- 파벌 0개: (가) 회의 버튼 비활성 + "파벌이 없어 회의를 열 수 없습니다" 한 줄.
- 첩보 수치(안정도·기자회견 관계 하락): 확정 아님, **미정 유지로 알파 6까지 끌고 감**(게임 적용 보류 상태 그대로).
- 포트레이트 빈 계열: 채우지 않음. 기본 계열 그림 사용, 사용자가 직접 올림.
- 아직 남은 결정: 연설 상황 보너스 나머지 방향(학구적만 확정), 의원 옷 규칙(지금 총독 우선), 의제 비는 시간이 짧은 문제.

## 6. 권장 순서

1. 포트레이트 라이브러리 컴파일·화면 확인(§3 실기) → 문제 있으면 즉시 수정.
2. 인게임 검수 세션 1회(§2) → LIVE_VALIDATION 기록 → 버그 수정 라운드.
3. 알파 6 신규: 선물 이벤트(5) → 수집품 1단계(6) → 라디오 후속 보도(3) → 수집품 2·3단계 → 버프 라이브러리 연결(7).
4. §5 결정 반영 → §4 배포 절차.
