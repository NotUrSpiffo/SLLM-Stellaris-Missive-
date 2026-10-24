# SLLM Missive — instalación (fork en español, es-MX)

1. Cierra el juego y la aplicación. Ejecuta el instalador EXE si partes de una instalación nueva.
2. La carpeta predeterminada es el Escritorio, `app\SLLM-Tester`. Confirma la carpeta real de Stellaris.
3. Si estás suscrito al mod en el Workshop, desmarca «instalar mod local». Si usas este fork, deja el mod local activado y **no** actives a la vez el del Workshop.
4. El mod local se copia y registra en `Documentos\Paradox Interactive\Stellaris\mod\sllm_missive_tester`.
5. En el lanzador deja un solo mod SLLM. Cuando la partida haya terminado de cargar, abre el acceso directo o `start_app.bat`.
6. No hace falta Node.js para jugar. El runtime (Electron) queda en `runtime\`. El primer arranque del instalador oficial no descarga nada de internet, pero **sí** puede completar la app desde el Workshop. Para este fork en español, copia después el `payload/app` compilado encima de esa carpeta y conserva `runtime\`. Tiene que existir `dist\main.js`.

El idioma de la interfaz de este fork es español (Latinoamérica). Puedes volver a coreano o inglés en Configuración → idioma de la interfaz. Las respuestas de la IA siguen el idioma de la interfaz, salvo que indiques otro en «idioma de respuesta de la IA».

Textos dentro de Stellaris: pon el juego en Español. Los archivos están en `tester-mod\localisation\spanish\` (`l_spanish`). El inglés del mod se conserva como respaldo si juegas en inglés.

No hace falta un parche aparte. La comprobación del ejecutable verificado (Stellaris 4.5.2, Windows x64) se mantiene.

Puedes instalar encima de una carpeta SLLM que ya tengas. El historial de la app se conserva. Desinstalar: `Uninstall-SLLM.exe`. Solo borra archivos del mod local cuyo hash no cambió y restaura la DLL; lo que hayas añadido se queda.
