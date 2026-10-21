# 알파 9 설치기·업데이트 묶음 — 2026-10-20

- 버전: 0.1.0-alpha.9. 실행 앱·payload package/lock·tester-mod descriptor/HELLO·installer APP_VERSION 일치. 설치 안내와 한/영 릴리스 노트 첫머리 갱신, 기존 기록 보존.
- 설치기: 바탕화면 새 폴더/SLLM-Missive-Tester-Setup-0.1.0-alpha.9.exe (dev/dist에도 동일 파일).
- 크기: 298.3 MiB (제작 도구 표시).
- SHA256: DDB0E550B2FCE79858B22ADB4AE03B0BB6B918CBB379556118F885269171E15A
- 업데이트 묶음: 문서/Paradox Interactive/Stellaris/mod/sllm_missive/sllm_app_update, 629개 파일, 244.4 MiB. 기존 공개 키와 일치하는 서명 및 전체 파일 해시 확인.
- 앱의 실제 업데이트 검사로 alpha.8, alpha.8.2, alpha.8.3에서 alpha.9를 available로 인식하는지 확인(현재 앱 파일+이전 버전 식별자를 사용한 읽기 전용 검사).
- 7-Zip 목록에서 runtime/electron.exe, dist/main.js, ui/office.html, tester-mod/descriptor.mod, native/command-bridge.dll, start_app.bat 포함 확인.
- 빌드 성공. selftest 3047 통과·4 실패: 기존 safety env 경로 차이로, 기존 제작 스크립트에 정해진 예외 처리로 진행했다. 검사 전체 통과로 표현하지 않음. 세이브 전환 회귀 9개 통과.
- 제작 중 소스와 포장 소스의 차이 0개 확인. 설치 경로·바로가기 설정은 변경하지 않음.
- 제작 도구의 임시 node_modules 정리는 경로·junction 여부 검사 후 .NET 비재귀 삭제로 변경(다른 셸로 넘기지 않음).
- 실제 설치 실행/게임 플레이/사용자 데이터 업데이트 실기는 미실시. 창작마당 업로드와 외부 배포는 하지 않음. 문서 모드의 게임 콘텐츠는 이번 작업에서 별도 동기화하지 않았고 앱 업데이트 묶음을 갱신했음.