# Instrucciones vigentes del proyecto

## Objetivo y autorización actual

Este fork pretende incorporar PDF.js dentro de ZenNotes y añadir herramientas de estudio inspiradas en PDF++: enlaces a selecciones de texto y figuras, citas Markdown, atajos y navegación entre documentos y notas. La búsqueda de texto debe incluir el contenido de los PDF mediante `rga` o una alternativa justificada, tanto en la interfaz como en MCP `search_text`.

Fuente de requisitos: conversación con el usuario del 23/11/2026. El usuario descartó la integración de Trazo como dirección del proyecto y prefirió PDF.js. Su último encargo autoriza crear el fork, clonarlo en `~/Work/` y preparar estas instrucciones. **La implementación funcional todavía no ha empezado y no forma parte de este incremento de preparación.** Al retomar, atender al nuevo encargo del usuario; esta constancia no es una prohibición permanente ni exige reconfirmar trabajo ya autorizado.

Consulta [TODO](TODO.md) y la [nota inicial](../SeguimientoAgente/2026-11-23-preparacion-pdfjs.md).

## Repositorio y mantenimiento

- Ruta local: `/home/dog/Work/zennotes`.
- `origin`: fork `Alejandro-Rodriguez-Santos/zennotes`.
- `upstream`: `ZenNotes/zennotes`.
- Rama inicial de trabajo: `feat/pdfjs-study`, creada desde `main`.
- Base inspeccionada: `10345414d3106f716f000e128dd6810466706bf7` (versión declarada 2.90.0).
- Mantener cambios pequeños y enfocados; no mezclar refactorizaciones ajenas, formateo global ni actualizaciones de dependencias no necesarias.
- No publicar issues, comentarios, PR, releases ni cambios en upstream sin encargo que lo autorice. `CONTRIBUTING.md` pide discutir cambios no triviales antes de contribuirlos a upstream; eso no bloquea el desarrollo privado/local del fork.
- No instalar ni sustituir la aplicación habitual del usuario como parte de compilar o probar. Usar un vault temporal y configuración aislada para las pruebas.

## Arquitectura a respetar

Lee [CONTRIBUTING.md](../../CONTRIBUTING.md), [arquitectura](../../docs/monorepo-architecture.md) y [app-core](../../packages/app-core/README.md).

- `packages/app-core`: interfaz compartida React/TypeScript, pestañas, paneles y visor.
- `packages/bridge-contract`: contrato tipado entre interfaz y host; sin dependencias de Node ni de implementaciones del dominio.
- `apps/desktop`: Electron, preload, IPC y ejecución de procesos locales.
- `apps/web`: adaptador de navegador; no puede ejecutar directamente `rga` local.
- No introducir `child_process`, rutas locales o llamadas Electron dentro de componentes compartidos. Añadir capacidades opcionales y degradación clara para runtimes que no soporten la nueva búsqueda.

Primera entrega propuesta: escritorio Linux con vault local. Preservar compilación y comportamiento de otros runtimes; ampliar búsqueda remota, servidor y móvil queda para un alcance posterior. El alcance final se contrasta con el siguiente encargo.

## Requisitos y decisiones por validar

### Visor y navegación

- Incorporar PDF.js en pestañas y panel de referencia; reutilizar un componente/servicio común para evitar dos implementaciones divergentes.
- Conservar apertura de archivos y enlaces existentes a página, zoom y posición. Inventariar también los embeds en notas antes de decidir su migración.
- Empaquetar worker, fuentes y recursos para funcionamiento local/offline; no depender de CDN.
- Coordinar foco y atajos con el editor y la paleta de ZenNotes. No interceptar escritura o teclas globales indiscriminadamente.
- Evitar cargar/renderizar todas las páginas a resolución completa; cancelar tareas obsoletas y liberar documentos/recursos al cerrar.

### Citas, selecciones y figuras

- Seleccionar texto o una región rectangular y generar una cita/enlace que permita volver al lugar exacto.
- Definir y documentar el contrato de enlace antes de extenderlo por el vault. Los nombres de parámetros nuevos aún no están decididos.
- Guardar regiones en coordenadas de página PDF, con una conversión definida para zoom, rotación y cajas de página; no guardar píxeles de pantalla.
- Distinguir número de página físico y etiqueta impresa; presentar claramente la diferencia.
- Para selección de texto, valorar ancla textual con contexto y geometría. Definir el comportamiento si el PDF se sustituye o cambia de estructura; no prometer enlaces permanentes ante cualquier edición.
- Notas y citas deben permanecer legibles como Markdown. Los resaltados derivados de enlaces no deben modificar automáticamente el PDF original.
- Fase posterior: colores, backlinks por página/fragmento, previsualización de notas y recortes de figuras. No presuponer compatibilidad de parámetros con PDF++ sin comprobarla.

### Búsqueda de texto en PDF

- Unificar la experiencia de búsqueda de notas y PDF; mostrar archivo, página y fragmento con contexto.
- Extender tanto la búsqueda visual como MCP `search_text`, preservando el contrato existente de resultados Markdown o versionando/ampliando tipos de forma compatible.
- `rga` está instalado en la máquina inspeccionada y una prueba con `--json` devolvió archivo y prefijo `Page 2:`. No asumir que ese prefijo sea un campo estructurado de página garantizado en toda versión/adaptador.
- `rga` aporta candidatos de texto/página, no rectángulos. PDF.js debe localizar la coincidencia visible; contemplar normalización, guiones de final de línea, ligaduras y repeticiones. Si no se puede ubicar exactamente, abrir la página y explicar el límite.
- Ejecutar procesos desde el host con argumentos separados, sin interpolar consultas en un shell. Definir búsqueda literal/regex explícitamente y conservar la semántica de la búsqueda actual donde corresponda.
- Respetar límites, cancelación, alcance del vault y permisos MCP existentes antes de devolver contenido. No buscar fuera del alcance autorizado ni convertir resultados PDF en una vía para saltarse restricciones.
- Elegir una política de caché/extracción incremental y su invalidación al cambiar, mover o borrar archivos. Reutilizar las capacidades de caché de `rga` si bastan; evitar duplicar índices sin necesidad.
- Si falta `rga` o su extractor PDF, informar de la capacidad disponible sin bloquear búsqueda Markdown. OCR para escaneos es una ampliación separada; no asumir texto donde solo hay imágenes.

## Flujo de trabajo y verificaciones

1. Revisar estado Git, instrucciones, TODO y seguimiento antes de editar.
2. Identificar el incremento solicitado y sus criterios de aceptación. Para cambios que contradigan requisitos o arquitectura vigentes, comunicar la discrepancia antes de implementar; aplicar autorizaciones del usuario ya existentes.
3. Implementar y verificar en incrementos. Reutilizar patrones y pruebas existentes; añadir pruebas de comportamiento relevante, no tests que solo reproduzcan detalles internos.
4. Registrar decisiones, pruebas ejecutadas y pendientes en `doc/SeguimientoAgente/`; actualizar TODO.

Entorno upstream declarado: Node >=22.22, npm 10.9.2. Scripts de referencia: `npm run typecheck`, `npm run test:run`, `npm run build`; desarrollo con `npm run dev`. Comprobar las versiones y scripts reales al empezar. En cambios funcionales, ejecutar pruebas dirigidas y las comprobaciones requeridas por upstream antes de considerar una entrega lista. Para este incremento exclusivamente documental basta validar enlaces y diff; no se ha instalado el entorno ni ejecutado la suite.

Casos mínimos para futuros incrementos: apertura offline, pestaña/panel, enlaces anteriores, texto multilínea, región de figura, zoom/rotación, resultado `rga` a página y coincidencia, PDF sin capa de texto, ausencia de `rga`, consultas canceladas, cambios de archivo y respeto de alcance MCP. Usar fixtures propios o públicos redistribuibles. Los PDF del vault Uni sirven como referencia manual privada, sin copiarlos al repositorio.
