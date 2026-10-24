# SLLM Missive — instalación manual (sin el .exe)

Para quien no quiere ejecutar el instalador. El ZIP trae lo mismo que el instalador pondría en la carpeta de la app, sin programa de instalación. Cada archivo está con su SHA-256 en `SHA256SUMS.txt`.

**Qué hay en el ZIP**

| Ruta | Qué es |
| --- | --- |
| `runtime\` | Runtime oficial de Electron (ejecuta la app) |
| `native\command-bridge.dll` | DLL que entrega un comando de juego cada vez |
| `tester-mod\` | Archivos del mod (mod local), incluida la localización en español |
| `dist\bootstrap.js` y 3 archivos `.js` de apoyo | Ayudante del primer arranque: completa el resto de la app desde el mod del Workshop, tras comprobar la firma **Ed25519** y el SHA-256 de cada archivo |
| `package.json`, `start_app.bat`, `update-public-key.pem` | Descriptor, lanzador y clave pública de las actualizaciones |

La app completa **no** viene en ese ZIP mínimo. En el instalador oficial entra desde el Workshop (artículo 3819625112) la primera vez.

## Este fork en español

Ese relleno del Workshop es la versión original (coreano/inglés), no este fork. Para jugar este fork:

1. Compila en `payload/app` con `npm install` y `npx tsc`.
2. Copia `payload/app` (con `dist\`, `ui\` y `ui\packs\es_MX`) encima de la carpeta extraída. Conserva `runtime\`.
3. Así existe `dist\main.js` y el ayudante del primer arranque no sustituye la app por la del Workshop.
4. Copia `tester-mod` al mod local como en el paso 5 de abajo, para que el juego lea `localisation\spanish`.

Si más adelante la app ofrece una actualización firmada del Workshop original, recházala: reemplazaría `ui\` y `dist\`.

## Pasos del ZIP

1. **Suscríbete** al mod en el Workshop solo si vas a usar esa copia. Cierra Stellaris. Con este fork basta el mod local del paso 5.
2. **Comprueba** el ZIP con el SHA-256 de las notas de la versión:
   `Get-FileHash .\SLLM-Missive-Manual-<version>.zip -Algorithm SHA256`
3. **Extrae** el ZIP en una carpeta vacía, por ejemplo `Escritorio\app\SLLM-Tester`.
4. *(Opcional)* **Comprueba la DLL**: `Get-FileHash .\native\command-bridge.dll -Algorithm SHA256` debe coincidir con el hash de las notas.
5. **Mod**: si quieres la copia local de este fork, en PowerShell desde la carpeta extraída:
   ```powershell
   $mods = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Paradox Interactive\Stellaris\mod'
   Copy-Item .\tester-mod (Join-Path $mods 'sllm_missive_tester') -Recurse
   $d = Get-Content .\tester-mod\descriptor.mod -Raw
   $d = [regex]::Replace($d, '(?m)^\s*(path|remote_file_id)\s*=.*\r?\n?', '')
   $d += "`r`npath=`"" + (Join-Path $mods 'sllm_missive_tester').Replace('\','/') + "`"`r`n"
   [IO.File]::WriteAllText((Join-Path $mods 'sllm_missive_tester.mod'), $d, [Text.UTF8Encoding]::new($false))
   ```
   Actívalo en el lanzador de Paradox. No actives dos mods SLLM a la vez.
6. *(Opcional, activa avisos de actualización)* crea el marcador del instalador:
   `Set-Content .\SLLM-tester-installed.txt 'SLLM Missive (instalación manual)'`
7. **Arranca** `start_app.bat` cuando el juego ya cargó. En el idioma del juego, elige Español para ver los textos del mod en español.

## Sobre la DLL del juego

Con esta disposición manual **no se copia nada dentro de la carpeta de Stellaris**. La app usa `native\command-bridge.dll` desde su propia carpeta si no existe `game-install-path.txt`. El instalador, en cambio, copia la DLL a la carpeta del juego. Si quieres ese esquema, copia la DLL a `<carpeta de Stellaris>\sllm-tester-command-bridge.dll` y escribe la ruta de Stellaris en `game-install-path.txt` (texto UTF-16).

La DLL no actúa en ninguna compilación que no sea la 4.5.2 verificada. Ejecuta Stellaris y SLLM con el mismo nivel de privilegios.

## Desinstalar

Borra la carpeta de la app. Si usaste la copia local del paso 5, borra también `Documentos\Paradox Interactive\Stellaris\mod\sllm_missive_tester` y `sllm_missive_tester.mod`. El historial y la configuración están en la carpeta de datos de la app y no se tocan.
