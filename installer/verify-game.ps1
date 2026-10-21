param([Parameter(Mandatory=$true)][string]$GameDir,[switch]$TestMode)
$ErrorActionPreference='Stop'
function FileHash([string]$Path){
 $stream=[IO.File]::OpenRead($Path);$sha=[Security.Cryptography.SHA256]::Create()
 try{return [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','')}
 finally{$stream.Dispose();$sha.Dispose()}
}
try {
 $exe=Join-Path $GameDir 'stellaris.exe'
 if(!(Test-Path -LiteralPath $exe)){throw 'stellaris.exe was not found in the selected folder.'}
 $hash=FileHash $exe
 if($hash -ne '400DF27C82DDC845AA9DCE79BD468D81F18F060D299CD263E3AFA93AEF4F7A83'){
  throw 'This release supports the verified Stellaris 4.5.2 build only. Select the correct installation or update SLLM.'
 }
 if(!$TestMode -and (Get-Process -Name stellaris -ErrorAction SilentlyContinue)){throw 'Close Stellaris before installing or updating the DLL.'}
 Write-Output 'Game version verified.'
 exit 0
}catch{Write-Output $_.Exception.Message;exit 1}
