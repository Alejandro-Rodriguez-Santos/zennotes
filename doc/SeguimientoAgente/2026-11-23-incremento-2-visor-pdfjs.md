# Incremento 2 — visor PDF.js y archivos PDF en Space f

Fecha de apertura: 23/11/2026. Estado: implementación y verificación completadas.

## Encargo y alcance

El usuario pidió continuar con el incremento de visor tras inventario/contratos y mantuvo la delegación Sol low. Añadió expresamente: la búsqueda de archivos `Space f` debe mostrar y abrir PDF del vault. Se implementa PDF.js en pestañas y referencias y búsqueda por nombre/ruta. Search text, MCP PDF, enlaces avanzados a texto/región y backlinks siguen en las fases posteriores.

Se delegaron con `gpt-6.1-sol`, `reasoningEffort=low`: componente inicial del visor, recursos offline, búsqueda de archivos y pruebas de ciclo del componente. El principal revisó las entregas, integró el visor, corrigió carga/limpieza/geometría/foco, ajustó ranking de archivos y realizó las verificaciones del producto real. No se crearon subagentes recursivos ni PR.

## Comportamiento entregado

- `PdfViewer.tsx` es el visor compartido de pestañas y referencia; carga core antes del módulo web PDF.js y sus estilos lazy, evitando la carrera de `globalThis.pdfjsLib` entre chunks.
- Canvas, capa textual seleccionable y anotaciones de visualización; controles de página, zoom, ajuste al ancho, rotación y búsqueda interna. Ctrl/Cmd+F abre búsqueda; Enter/Shift+Enter avanza/retrocede; Escape vuelve al lector; Ctrl/Cmd +/− cambia zoom. Con Vim activo h/j/k/l y gg/G desplazan; se conservan las secuencias globales de líder y paneles.
- Las referencias inactivas se desmontan, cancelan tareas y terminan workers. Un mapa acotado a 32 estados guarda solo posición, rotación y petición de salto, sin retener documentos, canvas ni nodos. La limpieza de layout captura la posición antes de retirar el DOM.
- Un nuevo nonce repite un salto sin recargar el documento. Mostrar una referencia oculta recupera su posición; seguir otra vez un enlace explícito vuelve al destino.
- Los offsets heredados de Chromium se mantienen como CSS px sin zoom desde la esquina superior izquierda. No se pasan a XYZ PDF.js como si fueran puntos PDF. Se carga la geometría real de la página de destino antes del salto, incluida su rotación, y se reserva espacio al final para poder situar el destino en la línea de foco al 20% del viewport.
- Un registro débil de lectores permite Copy link y Space P sin leer APIs privadas de Chromium. Los iframes nativos que aún existen conservan su fallback.
- `Space f` / paleta de búsqueda de archivos consulta nombres y rutas PDF desde `assetFiles`, abre con Enter mediante `openAssetInTab` y enfoca el lector. Consulta vacía conserva notas primero; consultas con texto mezclan ranking de notas y PDF. Consultas #tag siguen siendo de notas. Se excluye la papelera configurada. Un PDF coincidente exactamente no ofrece crear una nota `.pdf.md`.
- Errores y PDF con contraseña muestran un estado explícito con reintento o apertura externa; no se añade aún diálogo de contraseña ni edición del PDF.

## Recursos y runtimes

Dependencia fija `pdfjs-dist@6.5.438` en app-core y lockfile actualizado con npm 10.9.2. El plugin `pdfjsAssets` sirve/emite cmaps, fuentes y wasm; el worker se importa como asset Vite. Desktop, web y cloud están conectados; `zenNotesAssets` lo incorpora para hosts compartidos. El subagente comprobó builds pequeños con bases `./` y `/zennotes/` (203 assets por build), además de los builds del producto posteriores.

En Electron empaquetado (`file://`), `zen-pdfjs://asset/` expone exclusivamente recursos PDF.js del renderer, con validación de ruta/tipo y CSP específica para fetch/scripts de esos recursos. No expone el vault ni usa CDN. Dev/web mantiene URLs del mismo origen. El visor recibe las URLs de documento del bridge existente, sin construir rutas `file://` en app-core.

Preview y Live Preview **mantienen sus embeds nativos de momento**; sus acciones de abrir una pestaña o fijar referencia sí llegan al visor PDF.js. La ayuda de la aplicación explica esta diferencia. No se declara migración completa de todas las superficies.

## Archivos principales

- `packages/app-core/src/components/PdfViewer.tsx`, `.css` y `.test.ts`.
- `packages/app-core/src/lib/pdf-viewer-location.ts`, `pdf-viewer-registry.ts` y sus tests; `pdfjs-assets.ts`.
- `EditorPane.tsx`, `PinnedReferencePane.tsx`, `pdf-location-link.ts`, `VimNav.tsx` y `commands.ts`: integración, foco y copia.
- `SearchPalette.tsx`, sus pruebas y las de bloques: archivos PDF junto a notas.
- `packages/app-core/build/vite.mjs`, `vite.d.ts`, configs Vite de hosts y Vitest.
- `apps/desktop/src/main/pdfjs-assets.ts`, su prueba, protocolo en `main/index.ts` y CSP en `renderer/index.html`.
- `tooling/scripts/pdf-viewer-smoke.mjs`: recorrido real reproducible tras compilar, sin servidor de desarrollo.
- `packages/app-core/src/lib/help.ts`, instrucciones y TODO.

## Verificación y resultados

- `npm run typecheck`: comprobación final correcta, 9 tareas; tras adaptar la configuración async de Electron con retorno tipado.
- `NODE_OPTIONS=--no-experimental-webstorage npm run test:run`: suite completa correcta, 10.145 pruebas pasadas y 20 omitidas por la suite; 8 tareas. Incluye app-core (4.970), desktop (1.968), shared-domain (2.715), portable-vault (398), web (76) y quicklook (18).
- Después de ajustes finales de geometría/limpieza y nuevas pruebas de ranking/papelera: 131 pruebas dirigidas pasadas en 8 archivos y otras 33 de componente/paleta; son repeticiones de grupos relevantes, no deben sumarse a la suite como casos nuevos únicos.
- Pruebas específicas del protocolo: 7 correctas, incluyendo rutas no permitidas.
- `npm run build`: comprobación final del estado vigente correcta, 9 tareas, incluyendo CLI empaquetada verificable sin node_modules. Se conservan avisos existentes de chunks grandes y paquetes cuyo build solo verifica tipos.

Recorrido automatizado real:

```bash
npm run build
node tooling/scripts/pdf-viewer-smoke.mjs
```

Ejecuta el Electron compilado sobre un perfil, configuración y vault temporales. Genera un PDF propio de dos páginas (una rotada 90°), evita `ELECTRON_RUN_AS_NODE` heredado, no roba el foco del sistema y restaura el portapapeles textual al terminar. Comprueba mediante DOM/CDP:

1. Space f encuentra el archivo PDF y Enter abre canvas y capa de texto PDF.js.
2. Se pueden obtener cmap, fuente y wasm empaquetados bajo la CSP real, sin CDN.
3. Navegación de página, Ctrl+F, coincidencias resaltadas y Escape.
4. Rotación y copia de enlace de ubicación mediante registro nativo.
5. Referencia en página rotada con enlace heredado y retorno vertical a top=220 CSS px, con tolerancia de 2 px.
6. Ocultar desmonta el visor y termina su worker; mostrar recupera la lectura; repetir el enlace vuelve al destino original.

Todos esos puntos pasaron. No se accedió al vault Uni ni se instaló/sustituyó la aplicación habitual. Es verificación automatizada en el producto real, no una revisión manual completa de apariencia o accesibilidad.

Las primeras ejecuciones detectaron y se corrigieron problemas propios de este incremento: selector antiguo del buscador en tests, carga ESM del plugin en configuración CJS de escritorio, tipado contextual del config async y salto a geometría provisional de una página rotada. El primer smoke también necesitó retirar el modo Node heredado del entorno y desplegar Inbox en el fixture. No se ocultaron fallos mediante desactivación de tests.

## Cierre y siguientes pasos

El último build completo y typecheck terminaron con exit 0. Las pruebas de ayuda adicionales pasan (40 casos); enlaces locales y `git diff --check` revisados. Destino del incremento: `origin/feat/pdfjs-study`, sin PR ni instalación de la aplicación.

Siguiente fase: Search text con rga y MCP, y citas/enlaces de selección o figura según contratos v1. La migración de embeds de Markdown queda anotada como pendiente explícito, separada del visor ya operativo en pestañas/referencias.
