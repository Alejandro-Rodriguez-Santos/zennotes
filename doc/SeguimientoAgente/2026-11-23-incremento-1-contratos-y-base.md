# Incremento 1 — inventario, contratos y línea base

Fecha de apertura: 23/11/2026. Estado: completado. No introduce todavía cambios funcionales en el visor ni la búsqueda.

## Encargo y alcance

El usuario autorizó el primer incremento del TODO y pidió delegar subagentes en «Sol light». El catálogo no ofrece un preset literal light; se informó y se usaron dos subagentes `gpt-6.1-sol` con `reasoningEffort=low`, mediante delegación T3 y checkout compartido. Uno inventarió integración PDF/búsquedas y otro redactó los contratos. Ambos entregaron documentos separados; el agente principal revisó sus contenidos, corrigió la referencia a autorización de assets y verificó el entorno.

Este incremento cierra las tres tareas previas a la fase de visor: inventario, contrato de referencia y preparación/verificación de línea base. No se pidió ni se creó una plataforma general de plugins.

## Documentos y decisiones

- [Inventario PDF y búsquedas](../Diseno/inventario-pdf.md): pestañas, referencias, Preview, Live Preview, resolución de assets, navegación repetida, UI y MCP.
- [Contratos PDF v1](../Diseno/contratos-pdf.md): enlaces con namespace `zn-pdf-*`, página física, texto/contexto y regiones en espacio PDF; resultados discriminados sin inventar líneas Markdown para PDF.
- [Instrucciones](../AGENTS/AGENTS.md) y [TODO](../AGENTS/TODO.md) actualizados con el estado real.

Se conserva el comportamiento de enlaces y clientes antiguos. La ampliación MCP se plantea opt-in versionada; la UI tendrá un recorrido para notas y PDF sin cambiar el significado de offsets existentes. Debe aplicarse autorización de assets mediante las comprobaciones existentes `visibleAssets`/`assetFor` y respetar `refuseAssetBytes` en remoto restringido. Los presupuestos de tamaño/tiempo del contrato son propuestas por medir, no prestaciones implementadas.

Quedan para la fase funcional: conversión verificable de coordenadas heredadas de Chromium, contrato ejecutable y round-trip de enlaces, adaptación concreta de rga y permisos, recursos PDF.js offline, gestión de workers/memoria y foco. La referencia actual conserva hasta 16 iframes; no se trasladará automáticamente a 16 documentos PDF.js vivos.

## Entorno preparado

- Base funcional: upstream `10345414d3106f716f000e128dd6810466706bf7`; preparación documental previa `f79722de`.
- Rama `feat/pdfjs-study`, checkout `/home/dog/Work/zennotes`.
- Node `v26.12.0`; npm global `12.2.1`.
- Instalación reproducida con el gestor declarado: `npx --yes npm@10.9.2 ci --no-audit --no-fund`, exit 0; 1166 paquetes, parche upstream `app-builder-lib@26.15.7` aplicado. No se modificó el lockfile.
- Un primer `npm ci` con npm 12 terminó pero bloqueó scripts de dependencias por su política propia; se repitió con npm 10.9.2 para respetar el gestor upstream. No se cambiaron ajustes globales de npm ni paquetes del sistema.
- rga `0.10.10` y `pdftotext` disponibles.

## Verificaciones ejecutadas

| Comprobación | Resultado observado |
| --- | --- |
| `npm run typecheck` | Exit 0, 9 tareas correctas |
| Pruebas app-core de enlaces, disponibilidad PDF, Live Preview, assets PDF y búsqueda de notas | 31 pasadas en 5 archivos, con la opción Node indicada abajo |
| Pruebas desktop de ubicación PDF, vault-ops, carpetas de sistema y dos grupos de alcance MCP | 218 pasadas, 11 omitidas por la suite, 5 archivos |
| `npm run build` | Exit 0, 9 tareas correctas; CLI empaquetada verificable sin node_modules |
| rga sobre PDF sintético propio de dos páginas | Archivo y páginas 1/2 identificados en salida textual, dos apariciones en una línea, consulta ausente exit 1, búsqueda literal `.*` sin coincidencias |
| Consulta rga `Page 1` sobre ese fixture sin ese texto real | Confirmado falso hit en prefijo artificial; incorporado a contrato y matriz de aceptación |
| Enlaces locales de documentación y `git diff --check` | Comprobados antes del cierre |

Los comandos dirigidos reproducibles, desde la raíz:

```bash
NODE_OPTIONS=--no-experimental-webstorage npm run test:run --workspace @zennotes/app-core -- src/lib/pdf-location-link.test.ts src/lib/pdf-inline.test.ts src/lib/cm-live-preview-pdf-inline.test.ts src/lib/local-assets-pdf-inline.test.ts src/lib/note-search.test.ts
npm run test:run --workspace @zennotes/desktop -- src/main/pdf-view-location.test.ts src/mcp/vault-ops.test.ts src/mcp/scope-system-folders.test.ts src/mcp/scoped-backend-links.test.ts src/mcp/scoped-backend-local-links.test.ts
```

La primera ejecución de app-core sin la opción falló en 5 pruebas porque el `localStorage` experimental de Node 26 era undefined e interfería con jsdom. Las mismas 31 pruebas pasaron al usar `--no-experimental-webstorage`; no se modificaron producto ni tests para ocultar el fallo. No se ha ejecutado toda la suite `npm run test:run` del monorepo ni prueba gráfica interactiva. Las 249 pruebas dirigidas verifican la base upstream, no funcionalidades nuevas.

La compilación emite avisos existentes sobre chunks grandes, comentarios PURE de dependencias y outputs no generados por paquetes cuyo build es solo typecheck. No son errores ni se han intentado corregir fuera del alcance.

El fixture rga se generó con Python estándar fuera del repo, con texto propio en dos páginas y caché temporal. No se copiaron documentos del vault Uni. La salida JSON de rga tiene `path`, `lines`, `submatches` y offsets del texto extraído; no tiene campo estructurado de página ni geometría PDF. Las coincidencias del prefijo deben filtrarse antes de aplicar límites públicos.

## Límites y siguiente incremento

Sin cambios funcionales, sin PDF.js añadido aún, sin aplicaciones instaladas/sustituidas y sin ejecución contra el vault real. No se crearon PR ni publicaciones en upstream. Los archivos generados por build y node_modules quedan fuera de Git.

Siguiente incremento: integrar el visor PDF.js compartido en pestañas y referencias, empezando por fixtures de navegación heredada y carga offline. Decidir el tratamiento de Preview/Live Preview explícitamente para no dejarlo como una migración accidentalmente incompleta. Implementar los contratos v1 con pruebas de encoding, validación y geometría al añadir sus consumidores.
