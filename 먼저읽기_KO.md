# 다른 컴퓨터에서 SLLM 개발 이어가기

현재 알파3 소스·모드·설치기 원본·개발 기록을 옮기는 묶음입니다.

1. ZIP 전체를 다른 컴퓨터에 옮겨 압축을 풉니다.
2. `dist/SLLM-Missive-Tester-Setup-0.1.0-alpha.3.exe`로 앱·DLL을 설치합니다. 로컬 Tester 모드를 사용할 때만 로컬 모드 설치 옵션을 켭니다.
3. 개발 작업은 기본 설치 경로인 `바탕화면/app/SLLM-Tester`에서 이어갈 수 있습니다. 소스 원본은 이 묶음의 `payload/app`에도 있습니다.
4. 다른 컴퓨터의 Codex에서 작업할 앱 폴더를 열고, 아래 인수인계 문서와 `docs/CHECKLIST_KO.md`를 읽도록 요청하세요.
5. 앱은 `start_app.bat`으로 실행합니다. 첫 실행 시 의존성을 자동 설치합니다. Node.js 자체는 필요하지만 특정 버전을 강제하지 않습니다.

## 다음 Codex에 전달할 문장

SLLM 개발을 이어갑니다. 이 이동 묶음의 `HANDOFF_KO.md`, `docs/CHECKLIST_KO.md`를 먼저 읽고 현재 소스를 확인해 주세요. 현재 버전은 0.1.0-alpha.3이며 Node 버전 강제 검사는 제거했습니다. 코드와 문서를 읽기 전에 과거 alpha.2 코드로 덮어쓰지 마세요. 앱 모드 원본은 `tester-mod`, 게임이 읽는 로컬 모드는 Windows 문서의 `Paradox Interactive/Stellaris/mod/sllm_missive_tester`입니다.

## 들어 있는 것

- `payload/app`: 최신 앱 TypeScript·UI·빌드 결과·DLL과 C++ 소스·배경 규격 견본·모드 원본.
- `installer`: 알파3 통합 설치기 NSIS 소스, 게임 경로 탐색·검사·DLL 관리·로컬 모드 설치 도구.
- `dist`: Node 버전 제한 없는 알파3 통합 설치 EXE.
- `docs`: 체크리스트, 창작마당 소개글, 설치기 검증 기록.
- `HANDOFF_KO.md`: 개발 인수인계와 주의할 현재 상태.
- `build-installer.ps1`: Windows에서 NSIS로 설치기를 다시 만드는 스크립트.
- `MANIFEST_SHA256.json`: 전달 파일의 해시 목록.

## 다른 PC에서 다시 준비할 것

Node.js, npm으로 내려받는 Electron/개발 의존성, NSIS 컴파일러는 포함하지 않았습니다. 설치기 빌드에는 NSIS가 필요합니다. 개인 API 키와 Player2 로그인은 각 컴퓨터에서 설정해 주세요.

게임 본체·세이브·앱의 실제 플레이 대화 기록·개인 키 저장소는 이 묶음에 넣지 않았습니다. 여기서 '진행 기록'은 개발 체크리스트와 인수인계 문서를 뜻합니다.

대화 공유 링크: https://chatgpt.com/s/cx_6ad17a4ab8188191b90727e876a68b0b
이 링크는 대화 공유용 스냅샷이며 프로젝트 파일이나 이후 수정 사항을 자동 동기화하지 않습니다.
