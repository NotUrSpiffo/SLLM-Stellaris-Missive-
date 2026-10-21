# SLLM Missive - manual install (no installer .exe)

For people who prefer not to run the installer. This zip contains exactly what the installer would put in the app folder, with no installer program. Every file is listed with its SHA-256 in `SHA256SUMS.txt`.

**What is in this zip**

| Path | What it is |
| --- | --- |
| `runtime\` | Official Electron runtime (runs the app) |
| `native\command-bridge.dll` | Game bridge DLL (delivers one game command at a time) |
| `tester-mod\` | The game mod files (local mod) |
| `dist\bootstrap.js` and 3 helper `.js` files | First-run helper: fills in the rest of the app from the Steam Workshop mod, after checking its **Ed25519 signature and every file's SHA-256** |
| `package.json`, `start_app.bat`, `update-public-key.pem` | App descriptor, launcher, update-signature public key |

The full app is **not** in this zip. It comes from the Steam Workshop mod (item 3819625112) on first launch.

## Steps

1. **Subscribe** to the SLLM Missive mod on the Steam Workshop and let Steam finish downloading. Close Stellaris.
2. **Check the zip** against the SHA-256 in the release notes:
   `Get-FileHash .\SLLM-Missive-Manual-<version>.zip -Algorithm SHA256`
3. **Extract** the zip to a folder you choose, for example `Desktop\app\SLLM-Tester`. The folder must be empty.
4. *(Optional)* **Check the DLL**: `Get-FileHash .\native\command-bridge.dll -Algorithm SHA256` must match the DLL hash in the release notes.
5. **Mod**: if you subscribed on the Workshop, you are done with this step (do not enable two SLLM mods at once). If you want the local copy instead, run this in PowerShell from the extracted folder:
   ```powershell
   $mods = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Paradox Interactive\Stellaris\mod'
   Copy-Item .\tester-mod (Join-Path $mods 'sllm_missive_tester') -Recurse
   $d = Get-Content .\tester-mod\descriptor.mod -Raw
   $d = [regex]::Replace($d, '(?m)^\s*(path|remote_file_id)\s*=.*\r?\n?', '')
   $d += "`r`npath=`"" + (Join-Path $mods 'sllm_missive_tester').Replace('\','/') + "`"`r`n"
   [IO.File]::WriteAllText((Join-Path $mods 'sllm_missive_tester.mod'), $d, [Text.UTF8Encoding]::new($false))
   ```
   Then enable the mod in the Paradox launcher.
6. *(Optional, turns on update prompts)* create the marker file the installer would create:
   `Set-Content .\SLLM-tester-installed.txt 'SLLM Missive (manual install)'`
7. **Start** `start_app.bat`. On first launch the helper copies the app files from the Workshop mod after verifying the signature and hashes. If the mod is still downloading or older than this zip, it tells you and lets you retry.

## About the game DLL

With this manual layout, **nothing is copied into the Stellaris folder**. The app runs `native\command-bridge.dll` straight from its own folder when no `game-install-path.txt` exists. The installer, by contrast, copies the DLL into the game folder and records the path. If you want the installer's layout, copy the DLL to `<Stellaris folder>\sllm-tester-command-bridge.dll` and write the Stellaris folder path into `game-install-path.txt` (UTF-16 text); you do not need to.

The DLL itself refuses to act on any Stellaris build other than the verified 4.5.2 one. Run Stellaris and SLLM at the same privilege level.

## Uninstall

Delete the app folder. If you used step 5's local copy, also delete `Documents\Paradox Interactive\Stellaris\mod\sllm_missive_tester` and `sllm_missive_tester.mod`. Your chat history and settings live in the app data folder and are not touched.
