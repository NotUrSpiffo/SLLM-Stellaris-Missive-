# alpha.5 배포판 기록 — 2026-10-17 (집 PC 기준 최신본)

RELEASE_RULES_KO.md 순서대로 만들었다.

- 기준 소스: 바탕화면\새 폴더\app\SLLM-Tester (2026-10-17 09:16 상태, 컨테이너 사본과 파일 목록·크기 일치 확인. 실행 앱에만 있는 manage-dll.ps1·register-mod.ps1·tester-registration.json, 소스 없는 옛 빌드 dist/portraits.js 는 제외).
- 같은 날 이어서 다시 빌드(최종본): 연방 정상회담 안건 정리(결속 다지기·전쟁 선포 찬반), 흰 스크롤바→어두운 스크롤바(첩보·중재·만찬 등 6개 창), 기계 지성·군집 의식 대응 1~4(정체 표시, 전용 말투, 파벌 회의 비활성, 만찬 이름·연출), 통신 화면의 회색 원본 로그 숨김(개발자 모드에서만)+통신 로그, 상대별 통신 기록 분리가 추가됨.
- 포함 변경(alpha.4 이후): 평의회 실제 의제 키, 평화 중재 실제 전쟁 연결(점령·영유권 읽기, 영유권 안 점령지 이전, 종전·휴전), 해마다 중재 제안 알림(일반 제국끼리, A-B 전쟁, 피로도 확률), 강제 평화 현상 유지 규칙, 첩보 제재 게임 적용, 일반 통신 10회·호의 제거(만찬만).
- 버전: package.json/lock, tester-mod/descriptor.mod, HELLO version, setup.nsi APP_VERSION → 0.1.0-alpha.5. 문서 README_KO·ALPHA_SETUP_KO/EN·RELEASE_NOTES_KO/EN.
- 검사: TypeScript 빌드 통과, 자동 검사 PASS 1063 / FAIL 0.
- 설치기: dist/SLLM-Missive-Tester-Setup-0.1.0-alpha.5.exe, 83,496,821 바이트, SHA256 7ed6f748516fabe54687d9ff239f235fafe8476fb42a488a96f566194dfeffb7.
  - 리눅스 작업 환경에서 build-release.sh 로 빌드(제거 목록 자동 생성: 파일 559·폴더 37, 새 모드 파일 6개 포함(최종본)). 안에 runtime/electron.exe, dist/main.js, dist/features/peace-app.js, ui, tester-mod(sllm_probe_mediation·sllm_spy_*), native/command-bridge.dll(해시 5FBDE698…0B6C), start_app.bat, manage-dll.ps1, register-mod.ps1 확인. node_modules·tester-registration.json 없음.
  - 경로는 alpha.4와 동일(InstallDir·바로가기·로컬 모드 위치 변경 없음).
- 창작마당 모드 폴더: dist/workshop_0.1.0-alpha.5/sllm_missive (tester-mod 내용 + 창작마당 descriptor, remote_file_id 3819625112). 문서\…\mod\sllm_missive 에도 반영. 업로드는 사용자.
- 미검수: 실제 Windows 설치/덮어쓰기/제거, 게임 안 동작(연방 전쟁 선포 선전포고, 기계·군체 정체 판별(has_authority), 성계 이전·종전·휴전, 첩보 제재, 평의회 의제 설정, 해마다 중재 알림).
