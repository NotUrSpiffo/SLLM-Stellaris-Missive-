param([Parameter(Mandatory=$true)][string]$AppDir,[string]$DocumentsDir,[switch]$Remove)
$ErrorActionPreference='Stop'
function FileHash([string]$Path){
 $stream=[IO.File]::OpenRead($Path);$sha=[Security.Cryptography.SHA256]::Create()
 try{return [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','')}
 finally{$stream.Dispose();$sha.Dispose()}
}
function Within([string]$Root,[string]$Relative){
 $rootPath=[IO.Path]::GetFullPath($Root).TrimEnd('\')+'\'
 $full=[IO.Path]::GetFullPath((Join-Path $Root $Relative))
 if(!$full.StartsWith($rootPath,[StringComparison]::OrdinalIgnoreCase)){throw 'Unsafe mod path.'}
 return $full
}
try {
 $app=[IO.Path]::GetFullPath($AppDir)
 $stateFile=Join-Path $app 'tester-registration.json'
 if($Remove){
  if(!(Test-Path -LiteralPath $stateFile)){exit 0}
  $state=[IO.File]::ReadAllText($stateFile) | ConvertFrom-Json
  $registration=[IO.Path]::GetFullPath([string]$state.path)
  if([IO.Path]::GetFileName($registration) -ne 'sllm_missive_tester.mod'){throw 'Unexpected registration filename.'}
  if((Test-Path -LiteralPath $registration) -and (FileHash $registration) -eq $state.hash){Remove-Item -LiteralPath $registration}
  if($state.folder -and $state.files){
   $folder=[IO.Path]::GetFullPath([string]$state.folder)
   if([IO.Path]::GetFileName($folder) -ne 'sllm_missive_tester' -or [IO.Path]::GetFileName([IO.Path]::GetDirectoryName($folder)) -ne 'mod'){throw 'Unexpected mod folder.'}
   foreach($file in $state.files){
    $target=Within $folder ([string]$file.name)
    if((Test-Path -LiteralPath $target) -and (FileHash $target) -eq $file.hash){Remove-Item -LiteralPath $target}
   }
   if(Test-Path -LiteralPath $folder){
    Get-ChildItem -LiteralPath $folder -Directory -Recurse | Sort-Object {$_.FullName.Length} -Descending | ForEach-Object {if(!(Get-ChildItem -LiteralPath $_.FullName -Force | Select-Object -First 1)){Remove-Item -LiteralPath $_.FullName}}
    if(!(Get-ChildItem -LiteralPath $folder -Force | Select-Object -First 1)){Remove-Item -LiteralPath $folder}
   }
  }
  Remove-Item -LiteralPath $stateFile
  Write-Output 'Managed local mod removed; modified or extra files preserved.';exit 0
 }
 if(!$DocumentsDir){$DocumentsDir=[Environment]::GetFolderPath('MyDocuments')}
 if(!$DocumentsDir){throw 'Documents folder was not found.'}
 $modRoot=Join-Path $DocumentsDir 'Paradox Interactive\Stellaris\mod'
 $folder=Join-Path $modRoot 'sllm_missive_tester'
 $registration=Join-Path $modRoot 'sllm_missive_tester.mod'
 $source=Join-Path $app 'tester-mod'
 $descriptor=Join-Path $source 'descriptor.mod'
 if(!(Test-Path -LiteralPath $descriptor)){throw 'Bundled mod descriptor missing.'}
 if(Test-Path -LiteralPath $registration){
  $old=[IO.File]::ReadAllText($registration)
  $m=[regex]::Match($old,'(?m)^\s*path\s*=\s*"([^"\r\n]+)"')
  if(!$m.Success){throw 'An unrecognized local mod registration already exists.'}
  $oldPath=$m.Groups[1].Value
  if(![IO.Path]::IsPathRooted($oldPath)){$oldPath=Join-Path (Join-Path $DocumentsDir 'Paradox Interactive\Stellaris') $oldPath}
  $oldPath=[IO.Path]::GetFullPath($oldPath)
  if($oldPath -ne $folder -and $oldPath -ne $source){throw 'Another tester mod registration exists at a different path.'}
 }
 if(Test-Path -LiteralPath $folder){
  $existing=Join-Path $folder 'descriptor.mod'
  if(!(Test-Path -LiteralPath $existing) -or [IO.File]::ReadAllText($existing) -notmatch 'name\s*=\s*"SLLM'){throw 'Refusing to overwrite an unrelated mod folder.'}
 }
 New-Item -ItemType Directory -Path $folder -Force | Out-Null
 $files=@()
 foreach($file in Get-ChildItem -LiteralPath $source -Recurse -File){
  $relative=$file.FullName.Substring($source.Length+1)
  $target=Within $folder $relative
  New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($target)) -Force | Out-Null
  Copy-Item -LiteralPath $file.FullName -Destination $target -Force
  $files+=@{name=$relative;hash=(FileHash $target)}
 }
 $text=[IO.File]::ReadAllText($descriptor)
 $text=[regex]::Replace($text,'(?m)^\s*(path|remote_file_id)\s*=.*\r?\n?','')
 $text+="`r`npath=`"$($folder.Replace('\','/'))`"`r`n"
 $encoding=[Text.UTF8Encoding]::new($false)
 [IO.File]::WriteAllText($registration,$text,$encoding)
 $state=@{path=$registration;hash=(FileHash $registration);folder=$folder;files=$files} | ConvertTo-Json -Depth 8
 [IO.File]::WriteAllText($stateFile,$state,$encoding)
 Write-Output 'Local mod copied to Documents and registered.';exit 0
}catch{Write-Output $_.Exception.Message;exit 1}
