# TODO — PDF.js y herramientas de estudio

## Preparación

- [x] Crear el fork en GitHub y clonarlo en `/home/dog/Work/zennotes`. [Evidencia](../SeguimientoAgente/2026-11-23-preparacion-pdfjs.md).
- [x] Configurar `origin`/`upstream` y crear `feat/pdfjs-study` desde `main`. [Evidencia](../SeguimientoAgente/2026-11-23-preparacion-pdfjs.md).
- [x] Preparar AGENTS, requisitos, seguimiento y esta lista; distinguir diseño de implementación. [Evidencia](../SeguimientoAgente/2026-11-23-preparacion-pdfjs.md).

## Próximo incremento — después del encargo de implementación

- [ ] Inventariar las entradas PDF (pestaña, referencia, embeds), enlaces actuales y búsquedas UI/MCP; documentar puntos de cambio y compatibilidad.
- [ ] Concretar el contrato de enlaces de texto/región y los tipos de resultado PDF, con ejemplos y criterios de aceptación.
- [ ] Comprobar herramientas/entorno, instalar dependencias del repo y registrar una línea base de las comprobaciones pertinentes.

## Fase 1 — visor integrado

- [ ] Integrar PDF.js con recursos offline y un visor compartido para pestañas y referencias; comprobar apertura, búsqueda interna, selección, navegación, zoom y cierre sin fugas.
- [ ] Conservar enlaces a página/zoom/posición y coordinar foco/atajos; comprobar con pruebas y un recorrido manual en un vault temporal.

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

## Cierre de cada entrega funcional

- [ ] Ejecutar las verificaciones exigidas para el alcance; registrar resultados reales y límites.
- [ ] Actualizar ayuda/documentación pertinente y seguimiento; revisar diff, compatibilidad y tareas restantes.

Fuera de la primera entrega: Trazo, incrustación de ventanas Qt, plataforma general de plugins, edición del PDF original, OCR automático y paridad completa con PDF++.
