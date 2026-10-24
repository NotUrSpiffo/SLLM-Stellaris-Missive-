# SLLM Missive — español (es-MX)

Mod no oficial de Stellaris y aplicación de escritorio (Electron) para conversar con líderes del juego: diplomacia, cartas, discursos, banquetes y más. La aplicación devuelve el resultado a la partida.

Este es un fork personal de [SLLM Missive](https://github.com/kissginaa/SLLM-Stellaris-Missive-) (GPL-3.0, autor original kissginaa). Se conservan la licencia, los avisos de copyright y el crédito del autor. La interfaz de este fork está en **español neutro de Latinoamérica (es-MX)** de forma predeterminada.

> Windows x64 y Stellaris **4.5.2 (una sola compilación verificada)**. No hay soporte para multijugador ni Ironman. Proyecto de fans, sin relación con Paradox Interactive.

Inglés: [README.md](README.md)

## Qué está en español

- La aplicación (botones, ajustes, avisos, menú y errores que ves).
- Los textos del mod en el juego si Stellaris está en **Español** (`l_spanish`). Si el juego está en inglés, el mod sigue mostrando el texto en inglés que ya traía.
- Las respuestas de la IA (líderes, secretaria, noticias, cartas, radio) salen en español latinoamericano cuando el idioma de la interfaz es español. En Ajustes puedes elegir otro idioma de respuesta.

El coreano sigue en el código como texto de origen de las traducciones, y la opción de idioma «Coreano» sigue disponible.

## Instalar en Windows

La forma habitual es el instalador de la versión publicada. Ese instalador es mínimo: copia el runtime de Electron, la DLL y el mod, y la primera vez completa la aplicación desde el mod del Workshop. **Esa actualización del Workshop es la versión original, no este fork.** Para quedarte con el español de este fork:

1. Cierra Stellaris y SLLM.
2. En una PC con Node.js, en `payload/app`:
   ```bash
   npm install
   npx tsc
   ```
3. Copia **toda** la carpeta `payload/app` encima de la instalación (por defecto `Escritorio\app\SLLM-Tester`). **No borres** `runtime\`. Tiene que quedar `dist\main.js` (si falta, el primer arranque vuelve a bajar la app del Workshop).
4. Copia también `payload/app/tester-mod` a `Documentos\Paradox Interactive\Stellaris\mod\sllm_missive_tester` (o deja que el instalador registre el mod local y luego vuelve a copiar `tester-mod` encima).
5. En el lanzador de Stellaris activa **un solo** mod SLLM. Pon el idioma del juego en Español.
6. Arranca con `start_app.bat` o el acceso directo, cuando la partida ya haya cargado. No hace falta Node.js en esa PC: el runtime de Electron va en `runtime\`.

Si aceptas una actualización dentro de la app que venga del Workshop original, se reemplazan `ui\` y `dist\` y vuelves al coreano/inglés. Para este fork, no aceptes esa actualización.

El instalador se genera en Windows con NSIS: `build-installer.ps1` o `make-installer.ps1` (reglas en `RELEASE_RULES_KO.md`). Incluye `tester-mod` (con `localisation/spanish`) y, si recompilas el instalador, `ALPHA_SETUP_ES.md`. El ZIP de instalación manual incluye `MANUAL_INSTALL_ES.md`.

Guías: [payload/app/ALPHA_SETUP_ES.md](payload/app/ALPHA_SETUP_ES.md) y [installer/MANUAL_INSTALL_ES.md](installer/MANUAL_INSTALL_ES.md).

## Licencia

GNU GPL-3.0. Ver [LICENSE](LICENSE). Electron es MIT, de sus autores. «Stellaris» pertenece a Paradox Interactive.
