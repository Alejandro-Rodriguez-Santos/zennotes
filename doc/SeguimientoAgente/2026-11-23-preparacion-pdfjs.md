# Preparación del fork para PDF.js y herramientas de estudio

Fecha de apertura: 23/11/2026. Estado: preparación documental completada; implementación funcional pendiente.

## Encargo

Crear un fork de ZenNotes dentro de `~/Work/` y preparar el archivo de instrucciones del agente. Se conserva la dirección acordada: visor PDF.js integrado, herramientas inspiradas en PDF++ y búsqueda de contenido PDF mediante `rga` o alternativa justificada, incluida MCP `search_text`.

## Resultado

- Fork: https://github.com/Alejandro-Rodriguez-Santos/zennotes
- Upstream: https://github.com/ZenNotes/zennotes
- Checkout: `/home/dog/Work/zennotes`.
- Rama: `feat/pdfjs-study`, desde `main` en `10345414d3106f716f000e128dd6810466706bf7`.
- Documentos propios: `AGENTS.md`, `doc/AGENTS/AGENTS.md`, `doc/AGENTS/TODO.md` y esta nota.
- La documentación upstream en `docs/` se mantiene en su ubicación original.

## Inspección previa que orienta el trabajo

- `packages/app-core/src/components/EditorPane.tsx`: `AssetTabView` muestra PDF mediante iframe.
- `packages/app-core/src/components/PinnedReferencePane.tsx`: pila de iframes para conservar estado del lector.
- `apps/desktop/src/main/pdf-view-location.ts`: lectura de página/posición y señalización sobre el visor interno de Chromium.
- `packages/app-core/src/lib/pdf-location-link.ts`: construcción y apertura de enlaces PDF existentes.
- `packages/app-core/src/lib/pdf-inline.ts`: disponibilidad de visor integrado.
- `packages/bridge-contract/src/bridge.ts`: contrato tipado de host.
- `apps/desktop/src/mcp/vault-ops.ts`: la implementación local de `searchText` inspeccionada recorre `.md`.
- Prueba previa local: `rga --json --fixed-strings --max-count 2 cortafuegos pdfs/Seg-T4es.pdf` devolvió coincidencias con archivo y prefijo `Page 2:`. Solo demuestra extracción de candidatos/página para ese PDF, no geometría, OCR ni integración en la aplicación.

Referencias de diseño: [PDF.js](https://mozilla.github.io/pdf.js/getting_started/), [rga](https://github.com/phiresky/ripgrep-all) y [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus). Son referencias técnicas; PDF++ no puede instalarse directamente en ZenNotes.

## Decisiones y límites

La primera entrega propuesta se centra en Linux de escritorio con vault local. Se documentó una ruta incremental: contrato y compatibilidad → visor → búsqueda/citas/regiones → backlinks y mejoras de estudio. Parámetros de enlace y persistencia final todavía requieren diseño y comprobación.

Este incremento no modifica código funcional, instala dependencias, reemplaza aplicaciones ni toca el vault Uni. No se han ejecutado compilación ni tests de la aplicación. No se ha publicado issue o PR en upstream.

## Verificaciones de cierre

Comprobados los enlaces locales de los cuatro documentos y el diff sin cambios funcionales. GitHub confirma que el repositorio es un fork de ZenNotes/zennotes. Los remotos origin/upstream y la rama feat/pdfjs-study corresponden a los destinos descritos. No se ejecutaron tests ni compilación al tratarse de preparación documental.

## Siguiente paso

Al recibir el encargo de implementación, empezar por el inventario de entradas PDF/búsquedas y el contrato de enlaces. La lista verificable está en [TODO](../AGENTS/TODO.md).
