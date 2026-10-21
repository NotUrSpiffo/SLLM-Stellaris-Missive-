# alpha.4 배포판 기록 — 2026-10-16 (집 PC 기준 최신본)

RELEASE_RULES_KO.md 순서대로 만들었다.

- 기준 소스: 바탕화면\새 폴더\app\SLLM-Tester (21:46 Codex 빌드 이후 상태) + 이번 수정(소문·신문 토큰 낭비).
- 수정 1: 소문 응답 한도 900→2000, 신문 1800→3500 (실사용 기록에서 소문 9건 중 8건, 신문 6건 중 4건이 한도에 닿아 글이 거의 없이 버려짐. Gemini 3 Flash 의 내부 생각 토큰이 응답 한도를 함께 씀).
- 수정 2: 소문은 게임 날짜가 바뀐 때만 생성(같은 세이브·같은 날짜면 건너뜀, 실패해도 같은 날짜엔 다시 안 부름). 기존엔 일시정지 중에도 실시간 10분마다 생성.
- 의회 토론 문맥 누적(사용자 보류)은 손대지 않음.
- 버전: package.json/lock, tester-mod/descriptor.mod, HELLO version, setup.nsi APP_VERSION → 0.1.0-alpha.4.
- 검사: TypeScript 빌드 통과, 자동 검사 PASS 986 / FAIL 0 (신규 '소문·신문 토큰 낭비 수정' 포함).
- 설치기: dist/SLLM-Missive-Tester-Setup-0.1.0-alpha.4.exe, 83,372,974 바이트, SHA256 f5e9c6d2261d0c89dd7e6bb854aa1e6cadda7d4a701cba7e3580fb75f6e57f8e.
  - 리눅스 작업 환경에서 build-release.sh 로 빌드. 안에 runtime/electron.exe(Electron 31.7.7, 공식 해시 확인), dist/main.js, ui, tester-mod, native/command-bridge.dll(해시 5FBDE698…0B6C), start_app.bat, manage-dll.ps1, register-mod.ps1 확인. node_modules·tester-registration.json 없음.
  - 경로는 alpha.3과 동일: 바탕화면\app\SLLM-Tester, 문서\…\mod\sllm_missive_tester, sllm-tester-command-bridge.dll, 바로가기.
- 창작마당 모드 폴더: dist/workshop_0.1.0-alpha.4/sllm_missive (tester-mod 내용 + 창작마당 descriptor, remote_file_id 3819625112). 문서\…\mod\sllm_missive 에도 반영.
- 미검수: 실제 Windows 설치/덮어쓰기/제거, runtime 실행, 게임 안 동작. 소문·신문 수정은 실사용 기록으로 재확인 필요(완료 토큰·형식 오류 감소 여부).
