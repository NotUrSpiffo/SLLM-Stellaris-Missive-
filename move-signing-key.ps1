# 앱 업데이트 서명 키를 다른 PC 로 옮긴다(2026-10-18). 서명키_옮기기.bat 이 부른다.
# 이 PC 에 키가 있으면 → 개발 폴더에 옮김용 사본을 만든다(내보내기). 개발 폴더를 다른 PC 로 옮긴 뒤 거기서 다시 실행하면
# → 그 PC 의 %USERPROFILE%\.sllm 에 넣고 옮김용 사본은 지운다(가져오기). 키가 앱(payload)의 공개 키와 짝인지 확인한다.
$ErrorActionPreference = 'Stop'
$dev = $PSScriptRoot
$payload = Join-Path $dev 'payload\app'
$tool = Join-Path $dev 'tools\make-app-update.js'
$home_key = Join-Path $env:USERPROFILE '.sllm\update-signing-key.pem'
$carry = Join-Path $dev '_서명키_옮김용_공유금지.pem'
function Check($k) { if (!(Get-Command node -ErrorAction SilentlyContinue)) { return 'NONODE' }; $r = & node $tool check $k $payload; if ($LASTEXITCODE) { return 'ERROR' }; return ($r | Select-Object -Last 1) }
function Same($a, $b) { return (Get-FileHash -LiteralPath $a).Hash -eq (Get-FileHash -LiteralPath $b).Hash }
try {
  Write-Host "=== SLLM 업데이트 서명 키 옮기기 ===" -ForegroundColor Green
  $hasHome = Test-Path -LiteralPath $home_key; $hasCarry = Test-Path -LiteralPath $carry
  if ($hasHome -and $hasCarry) {
    if (Same $home_key $carry) { Remove-Item -LiteralPath $carry -Force; Write-Host "  이 PC 에 이미 같은 키가 있습니다. 옮김용 사본을 지웠습니다. 끝." -ForegroundColor Green; exit 0 }
    Write-Host "  이 PC 의 키와 옮김용 사본이 서로 다릅니다. 아무것도 바꾸지 않았습니다." -ForegroundColor Red
    Write-Host "  이 PC 키:   $home_key  ($(Check $home_key))"; Write-Host "  옮김용 사본: $carry  ($(Check $carry))"
    Write-Host "  MATCH 인 쪽이 지금 앱에 들어 있는 진짜 키입니다. 틀린 쪽을 직접 지운 뒤 다시 실행하세요." -ForegroundColor Yellow; exit 1
  }
  if ($hasHome) {
    $c = Check $home_key
    if ($c -eq 'MISMATCH') { Write-Host "  주의: 이 PC 의 키가 payload 의 공개 키와 짝이 아닙니다. 그래도 내보냅니다(확인 필요)." -ForegroundColor Yellow }
    Copy-Item -LiteralPath $home_key -Destination $carry
    Write-Host "  내보냄: $carry" -ForegroundColor Green
    Write-Host "  이제 개발 폴더째 다른 PC 로 옮기고, 그 PC 에서 이 bat 을 한 번 더 실행하세요(가져온 뒤 사본은 자동으로 지워짐)."
    Write-Host "  이 사본은 디스코드·창작마당·공유 폴더에 올리지 마세요." -ForegroundColor Yellow; exit 0
  }
  if ($hasCarry) {
    $c = Check $carry
    if ($c -eq 'MISMATCH') { Write-Host "  옮김용 사본이 이 개발 폴더 앱(payload)의 공개 키와 짝이 아닙니다. 가져오지 않았습니다." -ForegroundColor Red; exit 1 }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $home_key) | Out-Null
    Copy-Item -LiteralPath $carry -Destination $home_key
    if (!(Same $home_key $carry)) { throw "복사한 키가 원본과 다릅니다." }
    Remove-Item -LiteralPath $carry -Force
    Write-Host "  가져옴: $home_key  (공개 키 확인: $c)" -ForegroundColor Green
    Write-Host "  옮김용 사본은 지웠습니다. 이제 이 PC 에서 설치기_만들기.bat 을 쓸 수 있습니다."; exit 0
  }
  Write-Host "  이 PC 에도, 개발 폴더에도 서명 키가 없습니다." -ForegroundColor Yellow
  Write-Host "  키를 처음 만드는 PC 라면 설치기_만들기.bat 을 한 번 실행하면 자동으로 생깁니다."
  Write-Host "  키가 있는 PC 에서 먼저 이 bat 을 실행해 내보내 주세요."; exit 1
} catch { Write-Host "[실패] $($_.Exception.Message)" -ForegroundColor Red; exit 1 }
