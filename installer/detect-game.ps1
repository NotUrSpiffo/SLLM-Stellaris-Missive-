param([Parameter(Mandatory=$true)][string]$Output)
$roots=@()
foreach($key in @('HKCU:\Software\Valve\Steam','HKLM:\SOFTWARE\WOW6432Node\Valve\Steam')){
 $item=Get-ItemProperty -Path $key -ErrorAction SilentlyContinue
 if($item.SteamPath){$roots+=$item.SteamPath};if($item.InstallPath){$roots+=$item.InstallPath}
}
$roots+=Join-Path ${env:ProgramFiles(x86)} 'Steam'
$libraries=@($roots)
foreach($root in $roots){
 $vdf=Join-Path $root 'steamapps\libraryfolders.vdf'
 if(Test-Path -LiteralPath $vdf){
  $text=Get-Content -LiteralPath $vdf -Raw
  foreach($m in [regex]::Matches($text,'"path"\s+"([^"]+)"')){$libraries+=$m.Groups[1].Value.Replace('\\','\')}
 }
}
$found=$null
foreach($library in ($libraries|Select-Object -Unique)){
 $candidate=Join-Path $library 'steamapps\common\Stellaris'
 if(Test-Path -LiteralPath (Join-Path $candidate 'stellaris.exe')){$found=$candidate;break}
}
if(!$found){$found=Join-Path ${env:ProgramFiles(x86)} 'Steam\steamapps\common\Stellaris'}
[IO.File]::WriteAllText($Output,$found,[Text.UnicodeEncoding]::new($false,$false))
