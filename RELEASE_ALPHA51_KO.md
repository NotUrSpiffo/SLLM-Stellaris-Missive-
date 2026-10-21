# 알파 5.1 긴급 통합 배포 — 2026-10-17

- 버전: 0.1.0-alpha.5.1. 최신 실행 앱의 소스/UI/모드와 동일함을 확인한 고정 사본으로 빌드.
- 포함 내용: RELEASE_NOTES_KO.md / RELEASE_NOTES_EN.md. 오래된 계획 문서보다 실제 구현을 우선해 호외·영어 번역을 포함했다. 미구현 선물·라디오 후속 보도는 완료로 표시하지 않았다.
- TypeScript 빌드 통과. 자동 검사 PASS 1102 / FAIL 4. 네 실패는 기존 실제 Windows 문서·Steam·게임 경로와 격리 환경 가정의 차이. 테스트 로그: alpha51-release/selftest-alpha51.txt.
- 설치기 크기: 83614825 bytes.
- SHA256: 312F23F300156B58D1EBC128E92D11F455A2A5CC37D0CE70F9CF9830B83F6455
- Electron 31.7.7 공식 ZIP SHA256 검증 후 포함. Node.js 설치 불필요. 기존 경로·DLL 해시·사용자 기록 보존 규칙 유지.
- 같은 payload로 만든 TEST_MODE 설치기를 별도 게임 복사본·문서·앱 폴더에 설치해 확인. 실제 사용자 폴더에 배포 설치기는 실행하지 않음. 신규 게임 효과의 실제 플레이 검증은 이번 빌드에서 수행하지 않음.
- 중복 등록 원인: 로컬 sllm_missive.mod와 ugc_3819625112.mod가 같은 이름/ID. 로컬 등록을 비활성화한 뒤 사용자가 정상 인식을 확인. 비활성화 파일은 유지하고 업로드 등록을 다시 생성하지 않았다.
- 창작마당 결과: dist/workshop_0.1.0-alpha.5.1/sllm_missive. 문서/mod/sllm_missive 업로드 원본도 갱신. Steam 구독 폴더는 직접 수정하지 않음. 업로드는 수행하지 않음.