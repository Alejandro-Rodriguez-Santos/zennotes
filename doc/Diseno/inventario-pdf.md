# Inventario de PDF y búsqueda

Inspección estática del 23/11/2026, rama `feat/pdfjs-study`. Este documento describe código existente y puntos de intervención; no constituye una integración ni un contrato nuevo aprobado. Se leyeron AGENTS, sus documentos enlazados y código del repositorio. No se leyeron ENV ni documentos personales; no se instalaron dependencias ni se ejecutó la suite. Por encargo, solo se escribe este archivo.

## Hallazgos prioritarios

1. Hay más superficies que pestaña y referencia: Preview Markdown y Live Preview construyen sus propios elementos PDF. Cambiar únicamente `AssetTabView` dejaría lectores Chromium y comportamientos distintos dentro de las notas.
2. El contrato `VaultTextSearchMatch` de la interfaz exige línea y offset Markdown. No se pueden reutilizar esos números para páginas PDF: la apertura actual llama a `openNoteAtOffset`.
3. MCP tiene otra implementación de búsqueda, y su filtro de alcance reconoce notas en `v.byPath`. Agregar resultados PDF al backend sin adaptar este filtro los descartaría; omitirlo para hacerlos visibles expondría contenido no autorizado.
4. La referencia conserva hasta 16 iframes montados, por URL con fragmento. Una sustitución directa por 16 documentos PDF.js activos puede multiplicar extracción, memoria y workers. Separar estado de lectura de recursos de renderizado.
5. Los enlaces actuales tienen semántica de navegación repetida mediante nonce y geometría Chromium. Conservar el formato no garantiza por sí solo conservar la posición visual al migrar coordenadas.

## Entradas y flujos existentes

Todas las rutas siguientes son relativas a la raíz del repositorio.

| Superficie | Código real | Flujo y punto de cambio |
| --- | --- | --- |
| Pestaña de archivo | `packages/app-core/src/components/EditorPane.tsx`, `AssetTabView` | Resuelve URL del host; PDF usa iframe, nombre único y `data-zen-pdf-path`. Añade fragmento y remonta por nonce. Sustituir rama PDF por visor común, manteniendo otras clases de archivo. |
| Identidad y apertura | `packages/app-core/src/lib/asset-tabs.ts`, `assetTabPath`, `assetPathFromTab`; `asset-tab-location.ts`, `openAssetInTab`, `assetTabLocation` | Identidad `zen://asset/<path>` independiente de página. Ubicación lateral en `useAssetTabLocations.byTab`; `pruneClosedTabs` elimina ubicaciones al cerrar. No incluir fragmento en identidad de pestaña. |
| Referencia fijada | `packages/app-core/src/components/PinnedReferencePane.tsx`; `asset-tab-location.ts`, `pinPdfReferenceAt` | `pinAssetReferenceForNote` asocia PDF/fragmento a nota. `referenceJumps` fuerza salto incluso si ya estaba fijado. `seenAssetUrls` conserva LRU de 16 URLs; `frameNameFor` identifica frames. Preservar volver al estado del lector y distinguirlo de seguir explícitamente un enlace. |
| Preview Markdown | `packages/app-core/src/lib/local-assets.ts`, `resolveLocalAsset`, `resolveAssetVaultRelativePath` y transformación de anchors/imágenes | Resuelve contra índice de assets y ruta de nota; anchors conservan `hrefFragment(raw)`. Ramas PDF pueden producir embed, placeholder de referencia o apertura externa. Revisar también `markdown.ts`, `use-rendered-markdown.ts` y `embed-renderers.ts`: no reemplazar el renderer Markdown completo. |
| Live Preview | `packages/app-core/src/lib/cm-live-preview.ts` | Detecta enlaces PDF independientes (también destinos entre `<...>`), crea figure y frame, botones de referencia/apertura/colapso y widget de archivo ausente. Respeta `pdfEmbedInEditMode` y el PDF fijado. El montaje/desmontaje CodeMirror necesita liberar el visor sin robar selección/foco. |
| Comandos/enlaces del editor | `packages/app-core/src/lib/cm-markdown-links.ts`; `pdf-location-link.ts`, `pdfFrameForCommand`, `copyPdfLocationLink` | El lector destinatario se elige por foco, panel activo y luego primer frame visible. No conservar una búsqueda exclusiva de `iframe` después de introducir un componente React/canvas. |
| Host sin lector nativo | `packages/app-core/src/lib/pdf-inline.ts`, `canShowPdfInline`; `components/PdfOpenElsewhere.tsx` | Se consulta `navigator.pdfViewerEnabled !== false`. Este indicador describe lector nativo, no disponibilidad del futuro PDF.js; sustituir la decisión por capacidad real manteniendo degradación. |

`local-assets.ts` tiene resolución prioritaria mediante `resolveAssetPathAmong` y fallback mediante `window.zen.resolveLocalAssetUrl`; con índice todavía no disponible puede no producir URL. Reutilizar esta resolución evita inventar una segunda interpretación de rutas relativas, nombres repetidos o archivos ausentes. Revisar fixtures existentes `local-assets-pdf-inline.test.ts`, `cm-live-preview-pdf-inline.test.ts`, `embed-renderers.test.ts` y `cm-markdown-links.test.ts` al modificar estas superficies.

## Enlaces, rutas y compatibilidad

`pdf-location-link.ts` genera `[archivo.pdf, p. 3](ruta.pdf#page=3&zoom=150,0,600)` mediante `pdfLocationMarkdownLink` y `pdfLocationFragment`. Codifica caracteres problemáticos del destino (`%`, espacios, paréntesis, `#`, `?`, corchetes) y escapa la etiqueta. La página es 1-based. `copyPdfLocationLink` degrada a enlace al archivo si el host no puede leer la ubicación.

`openAssetInTab` normaliza `#`, acepta fragmento solo para PDF y asigna nonce en cada apertura explícita. `pinPdfReferenceAt` conserva fragmento en la referencia y nonce por URL. Debe comprobarse repetir el mismo enlace tras desplazarse: no basta con cambiar una prop si su valor no ha cambiado.

`pdfFlashTargetFromFragment` solo interpreta página y tercer componente de zoom como top; sin página válida no señala destino. Un fragmento `#search=` o destino nominal puede seguir llegando al lector aunque no genere flash. No reducir todo fragmento heredado al subconjunto del flash.

`apps/desktop/src/main/pdf-view-location.ts` contiene `pdfLocationFromViewerState`, `pdfFlashBand`, `pdfFlashTargetFrom` y scripts que acceden a `pdf-viewer` de Chromium y ejecutan JavaScript en sus frames. Son acoplamientos específicos del visor actual, no servicios reutilizables de PDF.js. La lectura y flash están expuestos en `packages/bridge-contract/src/bridge.ts` e IPC `APP_PDF_VIEW_LOCATION` / `APP_PDF_FLASH_LOCATION`; habrá que conservar compatibilidad o migrar consumidores conjuntamente. No aplicar directamente el top heredado a coordenadas PDF sin validar zoom, origen, rotación y cajas de página.

Las URLs de contenido se obtienen del bridge (`resolveVaultAssetUrl`, `resolveLocalAssetUrl`), distintas de las identidades de navegación. `apps/desktop/src/main/index.ts` registra el protocolo `zen-asset` con `protocol.handle`; el visor debe consumir el acceso autorizado del host, no construir `file://` ni rutas absolutas desde app-core. Empaquetar worker, fuentes y recursos offline con las restricciones de cada runtime; comprobar CSP, carga binaria/rangos y cancelación en la fase funcional.

## Búsqueda visual

`packages/app-core/src/components/VaultTextSearchPalette.tsx` aplica debounce de 120 ms, llama `window.zen.searchVaultText` con preferencia de backend y rutas de rg/fzf; si falla usa `fallbackSearchVaultText` sobre notas. Descarta respuestas antiguas con `requestIdRef`, lo que no cancela procesos. Limita fallback a 80, excluye plantilla, calcula score y offset sobre texto Markdown. Al aceptar llama `openNoteAtOffset(match.path, match.offset, { scrollMode: 'center' })`; muestra `L{lineNumber}` y usa path/offset como key. Cambiar presentación, clave y navegación para resultados PDF, sin fabricar offsets Markdown.

`packages/bridge-contract/src/ipc.ts`: `VaultTextSearchBackendPreference` = auto/builtin/ripgrep/fzf; `VaultTextSearchToolPaths` solo contiene rutas rg/fzf; capacidades solo indican esos dos binarios. `VaultTextSearchMatch` exige path, title, folder, lineNumber, offset y lineText. `bridge.ts` expone capacidades y búsqueda sin señal de cancelación. La nueva extracción PDF necesita capacidad separada del ranking, tipo de destino y errores parciales expresables.

`apps/desktop/src/preload/index.ts` lleva al IPC de `main/index.ts`; este deriva a workspace remoto cuando corresponde o a `apps/desktop/src/main/vault.ts`. Allí `searchVaultText` resuelve backend, obtiene candidatos cacheados, excluye plantilla antes del ranking y llama `hydrateSearchOffsets`. `collectBuiltinSearchCandidates` / `collectRipgrepSearchCandidates` alimentan notas Markdown (rg usa glob `*.md`); `runFzfSearch` rankea candidatos. Añadir rga no equivale a sustituir rg: extracción de PDF y ranking son responsabilidades distintas. Invalidar caché PDF al cambiar/mover/borrar archivo y cambiar vault, sin tratar bytes PDF como UTF-8 Markdown.

`apps/web/src/bridge/http-bridge.ts`, `searchVaultText`, y `apps/desktop/src/main/remote/server-client.ts` delegan al servidor. No ejecutar rga en navegador ni prometer soporte remoto por añadirlo al host local. Degradar a búsqueda existente con capacidad PDF ausente explícita.

## MCP y controles de alcance

`apps/desktop/src/mcp/server.ts`, herramienta `search_text`, recibe query y limit (80 por defecto), llama `backend.searchText`; hoy promete coincidencias de notas vivas inbox/quick/archive, excluyendo plantilla. `apps/desktop/src/mcp/vault-ops.ts`, `searchText`, es un recorrido independiente: literal case-insensitive, línea a línea, previews de hasta 220 caracteres y enlace `buildOpenNoteDeepLink`. Recorre `LIVE_FOLDERS`, omite directorios ocultos, carpetas especiales en raíz primaria, plantilla y entradas no regulares/no `.md`. No comparte el ranking fuzzy de la paleta. No cambiar silenciosamente esta semántica al invocar rga.

`apps/desktop/src/mcp/scoped-backend.ts`, `ScopedBackend.searchText`, carga visibilidad y pide todos los candidatos antes de filtrar por `v.byPath` y `v.visible`, aplicando el límite después: evita que contenido oculto consuma la primera página. Esa tabla representa notas; una ruta asset PDF requiere autorización específica equivalente, no asumir que estar dentro del vault basta. `server.ts` además usa `isMcpToolOffered`, `scopeBackend`, `scrubVaultRoot` y sesión de vault; preservar ocultación de rutas absolutas y comportamiento al cambiar de vault.

Ya existen `visibleAssets`, `assetFor` y `readAsset` en el scoped backend; en remoto restringido `refuseAssetBytes` impide leer bytes. Reutilizar esas reglas para búsqueda, en vez de inventar una autorización nueva.

Recomendación: descubrir candidatos PDF solo en conjunto autorizado, validar ruta canónica y enlaces simbólicos antes de extracción, ejecutar con argumentos separados y límites de salida/tiempo, y filtrar antes del límite público. Revisar `packages/shared-domain/src/mcp-scope.ts` y las operaciones de assets del scoped backend para definir la política; no deducir permiso de lectura de PDF de una nota que solo lo menciona. Evitar mensajes stderr/caché/resultados con rutas o fragmentos fuera del alcance. No reutilizar `Number.MAX_SAFE_INTEGER` como presupuesto real para extracción pesada.

## Riesgos y decisiones pendientes

- Prueba local adicional: rga 0.10.10 devuelve falsos hits para `Page 1` cuando esa cadena solo pertenece al prefijo del extractor. Separar metadatos y verificar de nuevo contra contenido limpio antes de contar resultados.
- rga puede incluir prefijo textual `Page N:`: no es por sí mismo un campo estructurado garantizado. Validar con fixtures redistribuibles; distinguir página física, etiqueta y línea de salida del extractor.
- Una coincidencia extraída no proporciona geometría. Localizar después en capa textual PDF.js, contemplando ligaduras, guiones y duplicados; si falla, abrir página y comunicar que no se localizó con precisión.
- OCR, PDF cifrado, corrupto o sin texto requieren estados definidos; no bloquear resultados Markdown por error de un PDF.
- La caché de referencia actual incluye fragmento y puede duplicar un documento; definir caché documental por identidad y estado de vista por superficie. Cancelar tareas al cerrar, cambiar PDF o vault.
- Mantener comportamiento de preferencias, referencia por nota y navegación con ratón/Vim. Los comandos globales no deben capturar escritura ni seleccionar un lector oculto.
- El contrato MCP y el de interfaz tienen tipos homónimos pero rutas de ejecución distintas: validar ambos consumidores y adaptadores antes de añadir campos obligatorios.

## Criterios de aceptación para próximos incrementos

1. Abrir un mismo fixture desde pestaña, referencia, enlace Markdown, Live Preview y embed; verificar archivo correcto, fallback de ausente y recursos offline.
2. Mantener enlaces heredados de página/zoom/posición con nombres que contengan espacios, `%`, `#` y paréntesis; repetir enlace tras scroll y probar cierre/reapertura, panel dividido y referencia alternada.
3. Copiar ubicación desde el lector enfocado y sin foco; preservar enlace simple si no hay ubicación. Confirmar conversión visual de posición a varios zoom y rotaciones.
4. Buscar la misma cadena en nota y PDF desde paleta y MCP; mostrar página/contexto PDF, conservar líneas/offsets Markdown y abrir el destino apropiado. Validar ausencia de rga/extractor, error parcial, PDF sin texto y consultas superadas/canceladas.
5. Con alcance MCP restringido, probar PDF permitido, excluido, fuera de raíz y symlink; ningún contenido ni ruta absoluta excluidos llega a resultados/errores. El límite se aplica después del filtro autorizado.
6. Editar, mover, borrar y reemplazar el fixture, y cambiar vault durante búsqueda/carga: no reutilizar caché o resultados del documento anterior. Medir memoria con referencias sucesivas y liberar tareas/documentos al cerrar.

La verificación de este incremento es documental y estática; estos criterios todavía no se han ejecutado. El contrato de referencia se desarrolla en [contratos-pdf.md](contratos-pdf.md).
