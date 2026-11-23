# Contratos PDF — propuesta v1

Estado: contrato de referencia v1 para el primer incremento, sin implementación. Los presupuestos de rendimiento indicados son propuestas pendientes de medición, no prestaciones garantizadas. Alcance inicial: escritorio Linux y vault local; PDF.js compartido entre pestaña y referencia. No promete OCR, edición del PDF ni compatibilidad con PDF++.

## Base inspeccionada y compatibilidad

`packages/app-core/src/lib/pdf-location-link.ts` genera `#page=3&zoom=150,0,600`, codifica caracteres reservados de la ruta y escapa etiquetas Markdown. Su flash interpreta `page` y la tercera componente de `zoom`; estas coordenadas heredadas no son regiones PDF. `local-assets.ts::hrefFragment` conserva desde el primer `#`, sin interpretar su contenido; la clasificación elimina query/fragmento. `asset-tab-location.ts` separa identidad del archivo y ubicación, y usa nonce para repetir saltos. Conservar estas propiedades.

`packages/bridge-contract/src/ipc.ts::VaultTextSearchMatch` exige `folder`, `lineNumber` (línea del cuerpo Markdown, 1-based), `offset` (carácter del Markdown, 0-based) y `lineText`. `bridge.ts::searchVaultText` devuelve ese array. MCP usa otro tipo en `apps/desktop/src/mcp/vault-ops.ts`, con `link` y sin `offset`; `server.ts::search_text` devuelve un array de notas por defecto. `scoped-backend.ts` filtra por notas visibles antes del límite: no basta con insertar PDF en ese flujo, pues los descartaría o podría conceder permisos incorrectos.

Conservar firmas, resultados y búsqueda Markdown existentes. No reinterpretar `selection`, `rect`, `search`, destinos con nombre ni parámetros de terceros. Los enlaces heredados siguen pasando al adaptador heredado; la migración de sus zoom/posición requiere pruebas específicas, no convertirlos a puntos PDF por suposición.

## Enlace Markdown v1

Página física siempre 1-based, independiente de etiqueta impresa. `page` sigue siendo el destino mínimo compatible con visores externos. El namespace propio es `zn-pdf-`; activar interpretación avanzada solo con `zn-pdf-v=1`. Nunca inferir versión por presencia de texto o rectángulos.

Parámetros únicos:

| Parámetro | Valor |
| --- | --- |
| `page` | Entero decimal positivo, obligatorio para v1 |
| `zn-pdf-v` | `1` |
| `zn-pdf-kind` | `page`, `text` o `region` |
| `zn-pdf-exact` | Texto seleccionado; obligatorio para text |
| `zn-pdf-prefix`, `zn-pdf-suffix` | Contexto textual inmediatamente anterior/posterior, opcional |
| `zn-pdf-rect` | `x0,y0,x1,y1`; obligatorio para region, opcional para text |
| `zn-pdf-sha256` | SHA-256 de los bytes del archivo, 64 caracteres hex minúsculos; obligatorio al crear text/region |

Ejemplos exactos de sintaxis (el hash de ceros es ilustrativo, no la identidad de un fixture):

```markdown
[manual.pdf, p. 3](assets/manual.pdf#page=3)
[manual.pdf, p. 3](assets/manual.pdf#page=3&zoom=150,0,600)
[Manual de redes, p. 3](assets/Manual%20de%20redes.pdf#page=3&zn-pdf-v=1&zn-pdf-kind=page)
[Definición, p. 3](assets/manual.pdf#page=3&zn-pdf-v=1&zn-pdf-kind=text&zn-pdf-exact=estado%20de%20red&zn-pdf-prefix=El%20&zn-pdf-suffix=%20actual&zn-pdf-sha256=0000000000000000000000000000000000000000000000000000000000000000)
[Figura, p. 4](assets/manual.pdf#page=4&zn-pdf-v=1&zn-pdf-kind=region&zn-pdf-rect=36,72,300,240&zn-pdf-sha256=0000000000000000000000000000000000000000000000000000000000000000)
```

Una selección v1 pertenece a una página. Una selección multipágina produce enlaces separados por página; no truncar silenciosamente. La cita Markdown puede contener el texto legible fuera del enlace; el enlace no almacena ni altera anotaciones en el PDF.

## Coordenadas y ancla textual

Rectángulo en espacio de usuario PDF sin rotación: origen y orientación propios del PDF, x creciente a derecha, y creciente hacia arriba; valores absolutos respecto al origen PDF, no respecto al borde visible. Usar la caja efectiva `page.view` de PDF.js (intersección efectiva de cajas), que puede tener origen no cero. Las unidades son unidades de usuario PDF antes de aplicar `UserUnit`; no asumir siempre 1/72 de pulgada. Convertir esquinas con la inversa del viewport de la página, incluyendo zoom, rotación y UserUnit; ordenar mínimos/máximos después. Al mostrar, aplicar el viewport actual. Guardar hasta tres decimales; verificar tras redondeo. Una región debe tener área positiva y estar dentro de la caja efectiva; no recortar silenciosamente entradas inválidas.

Para texto: normalización compartida de extracción y selección: Unicode NFC y secuencias de whitespace a un espacio, conservando mayúsculas y puntuación. El generador obtiene exact/prefix/suffix de ese flujo normalizado (hasta 64 puntos de código de contexto por lado). No eliminar guiones ni expandir ligaduras como regla implícita; pueden usarse como heurística de búsqueda, pero nunca para declarar una selección exacta. Resolver en la página física indicada, con contexto como restricción. Solo una coincidencia inequívoca permite resaltar; repeticiones ambiguas abren página con aviso. Rect opcional ayuda a encuadrar, no sustituye validación textual.

## Validación, encoding y cambios

Separar ruta y fragmento antes de decodificar. Mantener resolución de assets del vault y controles de traversal/symlinks; un fragmento no concede acceso. Codificar valores UTF-8 mediante percent encoding RFC 3986, espacios `%20`, signo más `%2B`, `&` `%26`, `#` `%23`, paréntesis `%28`/`%29`; decodificar una sola vez. Escapar etiquetas Markdown como el helper actual. No decodificar `%23` de la ruta antes de separar fragmento.

Límites propuestos: fragmento codificado máximo 16 KiB; exact máximo 2048 puntos de código; contexto máximo 64 por lado; cuatro números finitos en rect, sin exponentes, máximo tres decimales; página entero seguro y no mayor que numPages al cargar. Rechazar duplicados de campos conocidos, escapes malformados, versión desconocida y combinaciones incompatibles. Ignorar campos namespaced desconocidos en v1 sin ejecutar acciones. En caso inválido, abrir archivo y, si existe un único `page` válido, esa página con aviso; nunca ejecutar texto del fragmento. Página fuera de rango: abrir documento en primera página con aviso, sin fingir destino correcto.

Hash calculado por host/servicio de documento, reutilizado por identidad de bytes y cancelable. Si no puede obtenerse, copiar enlace a página y explicar que no se creó ancla precisa. Si hash coincide: región válida se muestra; texto debe seguir siendo resoluble. Si falta hash o difiere: región no se resalta; texto puede relocalizarse solo en página indicada y con exact+context inequívocos, mostrando «PDF cambiado; texto relocalizado». No explorar otras páginas automáticamente. Si falla, abrir página con «ubicación no verificada». No reescribir enlaces. Invalidar cachés al sustituir/mover/borrar; mtime y tamaño son pistas de invalidación, no identidad criptográfica.

## Búsqueda UI y MCP compatible

Proponer método opcional nuevo `searchVaultContent(request)` y capacidad opcional `pdfTextSearchV1`; ausencia implica UI Markdown actual. El bridge sigue libre de Node; procesos y permisos viven en host. Request: `{requestId, query, kinds: ['markdown','pdf'], limit}`. Query literal, trim, comparación sin distinguir mayúsculas; regex fuera de v1. Vacía devuelve cero resultados. Máximo query 1024 puntos de código, limit entero 1..200, defecto 80; inválidos generan error de validación.

Respuesta: `{version:1, requestId, matches, pdfStatus, truncated, partial}`. Unión discriminada: Markdown `{kind:'markdown', note: <VaultTextSearchMatch existente>}`; PDF `{kind:'pdf', path, title, page?, pageLabel?, snippet, matchText, sourceRevision, locationConfidence:'page'|'document', href}`. `sourceRevision` es SHA-256 de los bytes consultados. `page` solo si el extractor prueba página física; etiqueta opcional solo presentación. Sin página fiable, confidence document, href al archivo y sin número inventado. No incluir `folder`, `lineNumber` ni `offset` Markdown en PDF. Snippet máximo 320 puntos de código, matchText máximo 2048; texto plano. Cada resultado representa candidato de extracción, no geometría verificada. PDF.js intenta localizarlo al abrir con las reglas anteriores; nunca tratar un prefijo `Page 2:` como campo estructurado sin validar adaptador/version y fixtures. La prueba local de rga 0.10.10 confirma que una consulta `Page 1` puede coincidir únicamente con el prefijo artificial. El adaptador debe separar metadatos del texto real y volver a verificar coincidencias sobre el contenido limpio, recomputando sus spans; no mostrar coincidencias del prefijo ni dejar que agoten el límite de resultados válidos.

MCP `search_text` sin opciones nuevas mantiene exactamente array y semántica Markdown. Opt-in explícito `resultVersion:1, kinds:['markdown','pdf']` devuelve el envelope anterior; para Markdown el campo note conserva el tipo MCP actual, incluido link. La UI conserva el tipo bridge actual en su rama Markdown. No imponer un único tipo antiguo artificial a ambos. Un runtime que no soporta la versión rechaza la opción claramente; no simula éxito PDF. Documentar ambas formas en schema y descripción de herramienta.

`pdfStatus`: `{state:'ready'|'unavailable'|'partial', reason?:'unsupported-runtime'|'missing-engine'|'missing-extractor'|'timeout'|'file-errors'}`. Sin motor/extractor, devolver Markdown y unavailable; escaneos sin capa textual no generan hits ni activan OCR. PDF cifrado/no legible se omite y produce partial sin exponer rutas fuera del alcance. Truncamiento separado de indisponibilidad. Orden v1 determinista por path POSIX, página y orden de extracción, límite global después de permisos; no prometer ranking comparable entre motores.

Cancelación: método opcional `cancelVaultContentSearch(requestId)` idempotente; id ligado a sesión/ventana y vault. Cancelar al cambiar consulta, vault o cerrar UI; MCP propaga cancelación de solicitud. Host termina proceso y descendientes, descarta respuesta obsoleta y libera recursos. Cancelación completa rechaza como cancelada, sin presentar parcial como éxito. Presupuesto v1: 10 s por solicitud, 50 MiB por PDF, 200 MiB de texto extraído total; al agotar, partial con razón y resultados autorizados ya completos. Ejecutar argumentos separados sin shell, sin extraer ejecutables ni seguir enlaces fuera del vault.

Alcance inicial: PDF locales bajo raíz de vault, excluidos trash, plantillas y carpetas de sistema/ocultas según políticas existentes. MCP aplica permisos de lectura de assets antes de extracción y antes de contar/límite. Un enlace desde una nota visible no autoriza por sí solo leer el asset. El predicado de referencia ya existe en `ScopedBackend.visibleAssets()` / `assetFor(raw, 'read')`; `readAsset` además aplica `refuseAssetBytes()` en remoto restringido. La implementación debe reutilizar o extraer esas mismas comprobaciones antes de ejecutar rga, sin crear una segunda política. Hasta conectar y probar ese recorrido, la capacidad PDF MCP permanece unavailable. No devolver rutas, conteos ni errores de archivos denegados. Caché siempre detrás de autorización, por identidad de documento y versión de extractor; no devolver fragmentos obsoletos tras reemplazo.

## Matriz de aceptación del futuro incremento

| Caso | Resultado exigido |
| --- | --- |
| Enlace antiguo page/zoom y destino nombrado | Conserva navegación heredada, sin reinterpretación como región |
| Mismo enlace seguido tras desplazar visor | Salta de nuevo en pestaña y referencia |
| Ruta con espacio, `#`, `%`, paréntesis; texto con `+`, `&` y Unicode | Round-trip sin doble decoding ni ruptura Markdown |
| Página impresa iv, física 4 | Navega a 4; etiqueta iv solo visual |
| CropBox con origen distinto, UserUnit, zoom y rotación 0/90/180/270 | Misma región PDF tras round-trip |
| Texto multilínea y repetido | Normaliza whitespace; solo resalta destino inequívoco |
| Duplicados, NaN, área cero, versión desconocida, página fuera de rango | Degrada con aviso, sin destino preciso falso |
| PDF sustituido con mismo nombre/tamaño | Hash invalida región y caché; texto solo relocaliza verificablemente |
| Selección multipágina o demasiado larga | Varios enlaces o página con aviso; sin truncamiento oculto |
| Cliente antiguo UI/MCP | Mismos arrays Markdown y significado de líneas |
| Cliente v1 con PDF | Archivo, página/contexto cuando verificables; sin líneas Markdown ficticias |
| Consulta `Page 1` presente solo en etiquetas del extractor | Cero hits por etiquetas artificiales; solo coincidencias del contenido real cuentan para el límite |
| rga ausente, extractor roto, escaneo o cifrado | Markdown operativo; estado explícito; sin OCR implícito |
| Consulta reemplazada/cancelada/timeout | Sin resultados tardíos; proceso liberado; timeout parcial explícito |
| Asset denegado, symlink externo o caché previa a revocar permisos | Sin contenido ni metadatos filtrados; límites después de autorización |

## Dudas técnicas que requieren prueba

- Verificar conversión del `zoom,left,top` heredado de Chromium al viewport PDF.js: conservar enlaces exige medir unidades y origen, no asumir equivalencia.
- Confirmar formato/versiones reales de rga y extractor para página física; si no existe salida fiable, usar adaptador de extracción por página o devolver candidatos de documento.
- Conectar el recorrido de búsqueda PDF con `visibleAssets`/`assetFor`, y comprobarlo con las pruebas de alcance existentes; el filtro actual de `searchText` está indexado por notas. No falta una política de assets, falta aplicarla a la búsqueda nueva.
- Medir hash y extracción con límites propuestos en fixtures redistribuibles; ajustar presupuestos mediante decisión explícita antes de implementar, sin prometer rendimiento no medido.
