# TODO — PDF.js y herramientas de estudio

## Preparación

- [x] Crear el fork en GitHub y clonarlo en `/home/dog/Work/zennotes`. [Evidencia](../SeguimientoAgente/2026-11-23-preparacion-pdfjs.md).
- [x] Configurar `origin`/`upstream` y crear `feat/pdfjs-study` desde `main`. [Evidencia](../SeguimientoAgente/2026-11-23-preparacion-pdfjs.md).
- [x] Preparar AGENTS, requisitos, seguimiento y esta lista; distinguir diseño de implementación. [Evidencia](../SeguimientoAgente/2026-11-23-preparacion-pdfjs.md).

## Incremento 1 — inventario, contratos y línea base

- [x] Inventariar las entradas PDF (pestaña, referencia, embeds), enlaces actuales y búsquedas UI/MCP. [Inventario](../Diseno/inventario-pdf.md).
- [x] Concretar el contrato de enlaces de texto/región y los tipos de resultado PDF, con ejemplos y criterios de aceptación. [Contratos v1](../Diseno/contratos-pdf.md).
- [x] Comprobar herramientas/entorno, instalar dependencias del repo y registrar una línea base de las comprobaciones pertinentes. [Resultados y límites](../SeguimientoAgente/2026-11-23-incremento-1-contratos-y-base.md).

## Incremento 2 / Fase 1 — visor integrado y búsqueda de archivos

- [x] Integrar PDF.js offline compartido en pestañas y referencias; comprobar apertura, capa textual, búsqueda, navegación, zoom y limpieza de workers. [Incremento 2](../SeguimientoAgente/2026-11-23-incremento-2-visor-pdfjs.md).
- [x] Conservar enlaces a página/zoom/posición y coordinar foco/atajos; comprobado con pruebas y recorrido real automatizado en vault temporal. [Evidencia](../SeguimientoAgente/2026-11-23-incremento-2-visor-pdfjs.md).
- [x] Incluir PDF en `Space f` por nombre/ruta, abrir con Enter en el visor integrado y conservar notas/tags y exclusión de papelera. Encargo añadido el 23/11/2026; [pruebas](../SeguimientoAgente/2026-11-23-incremento-2-visor-pdfjs.md).
- [ ] Migrar embeds de Preview/Live Preview al visor común en un incremento posterior; mientras tanto conservar el comportamiento nativo explícitamente.

## Fase 2 — recorrido completo de búsqueda y cita

- [ ] Integrar búsqueda PDF mediante `rga` en el host, con límites, cancelación y errores controlados; conservar búsqueda Markdown cuando no esté disponible.
- [ ] Mostrar resultados de PDF en Search text con documento, página y contexto; al abrir, localizar/resaltar la coincidencia o degradar explícitamente a página.
- [ ] Ampliar MCP `search_text` con resultados PDF sin romper consumidores ni controles de alcance; verificar casos permitidos y excluidos.
- [ ] Copiar una selección textual como cita Markdown con enlace; al pulsarlo, regresar al fragmento correcto.
- [ ] Seleccionar una región/figura y copiar su enlace; verificar posición a varios zoom y rotaciones.
- [ ] Comprobar el recorrido: buscar «inspección de estado» → abrir resultado → seleccionar texto/figura → pegar cita en nota temporal → volver al destino.

## Fase 3 — funciones inspiradas en PDF++

- [ ] Resaltados derivados de enlaces, colores y notas asociadas sin modificar el PDF original automáticamente.
- [ ] Navegación bidireccional y backlinks por página/fragmento, con actualización al cambiar notas.
- [ ] Previsualizaciones y recortes de figuras con persistencia definida.
- [ ] Atajos configurables y movimientos Vim para los flujos nuevos, sin conflictos con edición y búsqueda.

## Cierre del incremento 2

- [x] Ejecutar las verificaciones pertinentes y registrar resultados reales y límites en su seguimiento.
- [x] Actualizar ayuda, instrucciones y seguimiento; revisar diff y tareas restantes.

Fuera de la primera entrega: Trazo, incrustación de ventanas Qt, plataforma general de plugins, edición del PDF original, OCR automático y paridad completa con PDF++.
