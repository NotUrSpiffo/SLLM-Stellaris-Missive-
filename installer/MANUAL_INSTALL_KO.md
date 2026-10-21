# SLLM Missive 수동 설치 (설치기 exe 없이)

설치기를 실행하고 싶지 않은 분을 위한 방법입니다. 이 zip에는 설치기가 앱 폴더에 넣는 파일이 그대로 들어 있고, 설치 프로그램은 없습니다. 모든 파일의 SHA-256이 `SHA256SUMS.txt`에 있습니다.

**zip 안의 내용**

| 경로 | 설명 |
| --- | --- |
| `runtime\` | 공식 Electron 실행 프로그램(앱을 실행) |
| `native\command-bridge.dll` | 게임 연결 DLL(게임에 명령을 한 건씩 전달) |
| `tester-mod\` | 게임 모드 파일(로컬 모드) |
| `dist\bootstrap.js` 외 보조 `.js` 3개 | 첫 실행 도우미: 스팀 창작마당 모드에서 나머지 앱 파일을 **Ed25519 서명과 파일별 SHA-256을 확인한 뒤** 채웁니다 |
| `package.json`, `start_app.bat`, `update-public-key.pem` | 앱 정보, 실행 파일, 업데이트 서명 공개 키 |

앱 본체는 이 zip에 **들어 있지 않습니다**. 처음 실행할 때 스팀 창작마당 모드(항목 3819625112)에서 받습니다.

## 순서

1. 스팀 창작마당에서 SLLM Missive 모드를 **구독**하고 다운로드가 끝날 때까지 기다립니다. 스텔라리스는 종료합니다.
2. **zip 확인**: 릴리스 설명의 SHA-256과 비교합니다.
   `Get-FileHash .\SLLM-Missive-Manual-<버전>.zip -Algorithm SHA256`
3. 원하는 폴더(예: `바탕화면\app\SLLM-Tester`)에 **압축을 풉니다**. 빈 폴더여야 합니다.
4. *(선택)* **DLL 확인**: `Get-FileHash .\native\command-bridge.dll -Algorithm SHA256` 값이 릴리스 설명의 DLL 해시와 같아야 합니다.
5. **모드**: 창작마당을 구독했다면 이 단계는 끝입니다(SLLM 모드를 두 개 동시에 켜지 마세요). 로컬 복사본을 쓰려면 압축을 푼 폴더에서 PowerShell로 실행합니다.
   ```powershell
   $mods = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Paradox Interactive\Stellaris\mod'
   Copy-Item .\tester-mod (Join-Path $mods 'sllm_missive_tester') -Recurse
   $d = Get-Content .\tester-mod\descriptor.mod -Raw
   $d = [regex]::Replace($d, '(?m)^\s*(path|remote_file_id)\s*=.*\r?\n?', '')
   $d += "`r`npath=`"" + (Join-Path $mods 'sllm_missive_tester').Replace('\','/') + "`"`r`n"
   [IO.File]::WriteAllText((Join-Path $mods 'sllm_missive_tester.mod'), $d, [Text.UTF8Encoding]::new($false))
   ```
   그다음 Paradox 런처에서 모드를 켭니다.
6. *(선택, 업데이트 알림을 켭니다)* 설치기가 만드는 표시 파일을 직접 만듭니다.
   `Set-Content .\SLLM-tester-installed.txt 'SLLM Missive (manual install)'`
7. `start_app.bat`을 **실행**합니다. 처음에는 도우미가 창작마당 모드의 서명과 해시를 확인한 뒤 앱 파일을 채웁니다. 모드를 아직 받는 중이거나 이 zip보다 오래된 버전이면 안내를 띄우고 다시 확인할 수 있게 합니다.

## 게임 DLL에 대해

이 수동 방식에서는 **스텔라리스 폴더에 아무것도 복사하지 않습니다**. `game-install-path.txt`가 없으면 앱이 자기 폴더의 `native\command-bridge.dll`을 그대로 씁니다. 설치기는 DLL을 게임 폴더에 복사하고 경로를 기록하지만, 수동 방식에서는 필요 없습니다. 설치기와 같은 배치를 원하면 DLL을 `<스텔라리스 폴더>\sllm-tester-command-bridge.dll`로 복사하고 스텔라리스 폴더 경로를 `game-install-path.txt`(UTF-16 텍스트)에 적으세요.

DLL은 검증한 4.5.2 외의 스텔라리스 빌드에서는 동작을 거부합니다. 스텔라리스와 SLLM은 같은 권한(둘 다 일반 권한)으로 실행하세요.

## 제거

앱 폴더를 지웁니다. 5번의 로컬 복사를 했다면 `문서\Paradox Interactive\Stellaris\mod\sllm_missive_tester` 폴더와 `sllm_missive_tester.mod`도 지웁니다. 대화 기록과 설정은 앱 데이터 폴더에 있으며 건드리지 않습니다.
