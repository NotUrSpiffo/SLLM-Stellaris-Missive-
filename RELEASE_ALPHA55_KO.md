# 알파 5.5 통합 — 2026-10-17 (설치기 빌드 완료)

- 버전 표기만 0.1.0-alpha.5.5 로 올림(package.json·package-lock.json·tester-mod/descriptor.mod·HELLO 버전·setup.nsi·문서). 설치기·창작마당 폴더는 아직 만들지 않았다(RELEASE_RULES 3~5 순서대로 사용자 확인 후).
- 합친 내용: 알파 5.1 이후 ① 만찬 자원 선물 ② 대보관소 수집품·표본 선물 ③ 포트레이트 라이브러리 299종 ④ DLL 경로 자동 보정 ⑤ 버전 비교 수정(alpha.x.y 표기를 못 읽던 문제) ⑥ 통신 입력칸 잠김 수정(다른 세션) ⑦ 지도자 사망 오보 수정: radio 'leader_death'→'지도자 이탈', 신문 재료 제외(다른 세션) ⑧ 영어 인터페이스 누락 보완 ⑨ 총독 대화 주민 수가 300 으로 잘리던 문제(모드 단계 값 상한) 수정: pn=num_pops 정확값, 없으면 'N 이상'.
- 다른 세션 변경(radio.ts·features/council.ts·features/media.ts·ui/index.html)은 payload 에 있었고 실행 앱 3개 소스는 낡아 있어 payload 와 맞춤.
- 모드 파일 변경(창작마당 재업로드 필요): common/opinion_modifiers/sllm_specimen_gift_opinion.txt, localisation/{korean,english}/sllm_specimen_l_*.yml, common/scripted_effects/sllm_probe_archive.txt(표본 읽기), HELLO·descriptor 버전. 연결 규격(protocol=4)은 그대로.
- 창작마당 변경 글: 창작마당_변경사항_0.1.0-alpha.5.5.txt
- 검사(빌드 세션): 실행 앱의 TypeScript 5.9.3·@types/node·electron 타입으로 전체 tsc 빌드 통과, selftest(npm test 와 같은 src/selftest.ts) PASS 1233 / FAIL 0. 신규 회귀 검사 3개(지도자 이탈 문구·신문 재료 제외·입력칸 잠금 선언) 포함.
- 설치기: build-release.sh(리눅스 NSIS)로 생성. dist/SLLM-Missive-Tester-Setup-0.1.0-alpha.5.5.exe, 90,116,184 bytes, SHA256 8922572EB05516D2E9AF28D72497BC22B47E2F521902FF0CE86B7AF67DA70875. 게임 DLL 해시 5FBDE698…290B6C(기존과 같음). 제거 목록 파일 597·폴더 38 재생성. 바탕화면 새 폴더에 한 부 복사.
- 만든 뒤 확인: 7-Zip 이 작업 환경에 없어 EXE 목록 보기는 못 함 → 대신 설치기에 넣은 묶음(stage)에서 runtime/electron.exe·dist/main.js·ui/·tester-mod/·native/command-bridge.dll·start_app.bat·portrait-library.pak 확인. setup.nsi 의 InstallDir·CreateShortcut·register-mod.ps1 은 바꾸지 않음.
- 미검수: 실제 Windows 설치, 게임 안 동작(자원·표본 전달, 호의, 관계, 수집품 읽기, 주민 수). 창작마당 폴더(dist/workshop_0.1.0-alpha.5.5)는 아직 만들지 않음 → 모드 재업로드 전 필요.
- 참고: 개발 폴더 payload/app/dist 는 빌드 세션에서 다시 쓰지 않았다(설치기에는 새 빌드가 들어감). 개발 실행(start_app.bat→tsc)이나 Windows 빌드 전에 tsc 를 한 번 돌릴 것. 옛 dist/portraits.js 는 소스가 없어진 잔여물.
