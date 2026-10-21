Unicode true
!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "LogicLib.nsh"
!include "FileFunc.nsh"
!define APP_VERSION "0.1.0-alpha.10"
!ifndef PAYLOAD
!define PAYLOAD "..\payload\app"
!endif
Name "SLLM Missive Tester ${APP_VERSION}"
!ifdef TEST_MODE
OutFile "..\dist\SLLM-Missive-QA-Setup-${APP_VERSION}.exe"
RequestExecutionLevel user
!else
OutFile "..\dist\SLLM-Missive-Tester-Setup-${APP_VERSION}.exe"
RequestExecutionLevel admin
!endif
InstallDir "$DESKTOP\app\SLLM-Tester"
SetCompressor /SOLID lzma
ShowInstDetails show
Var GameDir
Var GameEdit
Var GameBrowse
Var Dialog
Var NoLocalMod
!ifdef TEST_MODE
Var DocumentsDir
!endif
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TEXT "SLLM ${APP_VERSION} 앱과 게임 연결 DLL을 설치합니다. 로컬 모드는 선택해 설치할 수 있습니다.$\r$\n$\r$\n앱 기본 경로: 바탕화면\app\SLLM-Tester$\r$\n실행 프로그램(Electron)이 함께 들어 있어 Node.js를 따로 설치할 필요가 없습니다.$\r$\n$\r$\n앱 본체는 Steam 창작마당의 SLLM Missive 모드 안에 들어 있습니다. 처음 실행할 때 구독한 모드에서 서명을 확인하고 채웁니다(먼저 구독해 주세요).$\r$\n$\r$\n창작마당 구독자는 로컬 모드 설치를 해제하세요. 테스터는 로컬 모드를 설치하고 런처에서 SLLM Missive - Tester를 켜 주세요."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_COMPONENTS
!define MUI_PAGE_CUSTOMFUNCTION_LEAVE AppDirLeave
!insertmacro MUI_PAGE_DIRECTORY
Page custom GamePage GamePageLeave
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_TEXT "앱과 게임 연결 파일을 설치했습니다.$\r$\n$\r$\n1. Paradox 런처에서 사용할 SLLM 모드 켜기$\r$\n2. 바탕화면의 SLLM Missive Tester 또는 start_app.bat 실행$\r$\n   (처음 한 번은 창작마당 모드에서 앱 파일을 채운 뒤 켜집니다)$\r$\n$\r$\nPlayer2 게임 클라이언트 ID는 기본 설정에 포함되어 있습니다."
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Korean"

Function .onInit
 SetShellVarContext current
 InitPluginsDir
 File /oname=$PLUGINSDIR\detect-game.ps1 "detect-game.ps1"
 File /oname=$PLUGINSDIR\verify-game.ps1 "verify-game.ps1"
 ${GetParameters} $0
 ${GetOptions} $0 "/GAMEPATH=" $GameDir
 ${GetOptions} $0 "/NOLOCALMOD=" $NoLocalMod
 !ifdef TEST_MODE
 ${GetOptions} $0 "/DOCUMENTS=" $DocumentsDir
 !endif
 ${If} $GameDir == ""
  nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\detect-game.ps1" -Output "$PLUGINSDIR\game-path.txt"'
  Pop $0
  Pop $1
  FileOpen $0 "$PLUGINSDIR\game-path.txt" r
  FileReadUTF16LE $0 $GameDir
  FileClose $0
 ${EndIf}
FunctionEnd

Function AppDirLeave
 IfFileExists "$INSTDIR\SLLM-tester-installed.txt" done
 FindFirst $0 $1 "$INSTDIR\*"
 loop:
  StrCmp $1 "" empty
  StrCmp $1 "." next
  StrCmp $1 ".." next
  FindClose $0
  IfSilent +2
  MessageBox MB_ICONEXCLAMATION "선택한 앱 폴더에 기존 파일이 있습니다. 빈 폴더 또는 기존 SLLM 설치 폴더를 선택해 주세요."
  SetErrorLevel 5
  Abort
 next:
  FindNext $0 $1
  Goto loop
 empty:
  FindClose $0
 done:
FunctionEnd

Function GamePage
 !insertmacro MUI_HEADER_TEXT "스텔라리스 게임 설치 폴더" "stellaris.exe가 있는 폴더를 선택하세요."
 nsDialogs::Create 1018
 Pop $Dialog
 ${NSD_CreateLabel} 0 0 100% 35u "Steam 라이브러리를 자동 탐색했습니다. 경로가 다르면 직접 지정하세요.$\r$\n문서의 Stellaris 사용자 폴더와는 다릅니다. 지원 버전: 검증한 4.5.2 빌드."
 Pop $0
 ${NSD_CreateDirRequest} 0 44u 82% 13u "$GameDir"
 Pop $GameEdit
 ${NSD_CreateBrowseButton} 84% 44u 16% 14u "찾아보기"
 Pop $GameBrowse
 ${NSD_OnClick} $GameBrowse BrowseGame
 nsDialogs::Show
FunctionEnd
Function BrowseGame
 nsDialogs::SelectFolderDialog "스텔라리스 설치 폴더" "$GameDir"
 Pop $0
 StrCmp $0 "error" done
 StrCpy $GameDir $0
 ${NSD_SetText} $GameEdit $GameDir
 done:
FunctionEnd
Function VerifyGame
 !ifdef TEST_MODE
 nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\verify-game.ps1" -GameDir "$GameDir" -TestMode'
 !else
 nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$PLUGINSDIR\verify-game.ps1" -GameDir "$GameDir"'
 !endif
 Pop $0
 Pop $1
 !ifdef TEST_MODE
 FileOpen $2 "$EXEDIR\install-test.log" w
 FileWriteUTF16LE $2 "GameDir=$GameDir$\r$\nCode=$0$\r$\n$1"
 FileClose $2
 !endif
 ${If} $0 != 0
  IfSilent +2
  MessageBox MB_ICONSTOP "$1"
  SetErrorLevel 2
  Abort
 ${EndIf}
FunctionEnd
Function GamePageLeave
 ${NSD_GetText} $GameEdit $GameDir
 Call VerifyGame
FunctionEnd

Section "SLLM 앱과 DLL" SEC_CORE
 SectionIn RO
 Call VerifyGame
 Call AppDirLeave
 SetOutPath "$INSTDIR"
 ; 최소 설치 구성(2026-10-21): 덮어쓰기 설치면 시작 파일을 지워 첫 실행 도우미가 창작마당 묶음과 다시 맞추게 한다(바뀐 파일만 복사).
 Delete "$INSTDIR\dist\main.js"
 File /r /x node_modules /x .git "${PAYLOAD}\*.*"
 File /oname=manage-dll.ps1 "manage-dll.ps1"
 File /oname=register-mod.ps1 "register-mod.ps1"
 FileOpen $0 "$INSTDIR\game-install-path.txt" w
 FileWriteUTF16LE $0 "$GameDir"
 FileClose $0
 FileOpen $0 "$INSTDIR\SLLM-tester-installed.txt" w
 FileWrite $0 "SLLM Missive ${APP_VERSION} pending"
 FileClose $0
 WriteUninstaller "$INSTDIR\Uninstall-SLLM.exe"
 nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\manage-dll.ps1" -GameDir "$GameDir" -Source "$INSTDIR\native\command-bridge.dll" -ExpectedHash "${DLL_HASH}"'
 Pop $0
 Pop $1
 ${If} $0 != 0
  IfSilent +2
  MessageBox MB_ICONSTOP "게임 DLL 설치에 실패했습니다.$\r$\n$1"
  SetErrorLevel 3
  Abort
 ${EndIf}
 FileOpen $0 "$INSTDIR\SLLM-tester-installed.txt" w
 FileWrite $0 "SLLM Missive ${APP_VERSION}"
 FileClose $0
 !ifndef TEST_MODE
 CreateShortcut "$DESKTOP\SLLM Missive Tester.lnk" "$INSTDIR\start_app.bat"
 !endif
 ; 앱 본체는 창작마당 모드에 있다. 아직 받지 않았으면 안내만 한다(설치는 계속).
 IfFileExists "$GameDir\..\..\workshop\content\281990\3819625112\sllm_app_update\manifest.json" ws_ok
 IfFileExists "$DOCUMENTS\Paradox Interactive\Stellaris\mod\sllm_missive\sllm_app_update\manifest.json" ws_ok
 IfSilent ws_ok
 MessageBox MB_ICONINFORMATION "Steam 창작마당의 SLLM Missive 모드를 아직 찾지 못했습니다.$\r$\n$\r$\n모드를 구독하고 다운로드가 끝난 뒤 SLLM Missive Tester를 실행하면 앱 파일이 채워집니다."
 ws_ok:
SectionEnd

Section "로컬 모드 설치 (창작마당 구독자는 해제)" SEC_MOD
 ${If} $NoLocalMod == "1"
  Goto local_done
 ${EndIf}
 !ifdef TEST_MODE
 nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\register-mod.ps1" -AppDir "$INSTDIR" -DocumentsDir "$DocumentsDir"'
 !else
 nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\register-mod.ps1" -AppDir "$INSTDIR"'
 !endif
 Pop $0
 Pop $1
 ${If} $0 != 0
  IfSilent +2
  MessageBox MB_ICONSTOP "로컬 모드 등록에 실패했습니다.$\r$\n$1"
  SetErrorLevel 6
  Abort
 ${EndIf}
 local_done:
SectionEnd

Section "Uninstall"
 SetShellVarContext current
 FileOpen $0 "$INSTDIR\game-install-path.txt" r
 FileReadUTF16LE $0 $GameDir
 FileClose $0
 nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\manage-dll.ps1" -GameDir "$GameDir" -ExpectedHash "${DLL_HASH}" -Remove'
 Pop $0
 Pop $1
 ${If} $0 != 0
  IfSilent +2
  MessageBox MB_ICONEXCLAMATION "게임 DLL을 제거하지 못했습니다. 게임을 종료하고 다시 확인해 주세요.$\r$\n$1"
  SetErrorLevel 4
  Abort
 ${EndIf}
 nsExec::ExecToStack '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\register-mod.ps1" -AppDir "$INSTDIR" -Remove'
 Pop $0
 Pop $1
 ${If} $0 != 0
  IfSilent +2
  MessageBox MB_ICONEXCLAMATION "로컬 모드 등록을 제거하지 못했습니다.$\r$\n$1"
  SetErrorLevel 7
  Abort
 ${EndIf}
 !include "uninstall-files.nsh"
 Delete "$INSTDIR\register-mod.ps1"
 Delete "$INSTDIR\manage-dll.ps1"
 Delete "$INSTDIR\game-install-path.txt"
 Delete "$INSTDIR\SLLM-tester-installed.txt"
 Delete "$INSTDIR\Uninstall-SLLM.exe"
 !ifndef TEST_MODE
 Delete "$DESKTOP\SLLM Missive Tester.lnk"
 !endif
 RMDir "$INSTDIR"
SectionEnd








