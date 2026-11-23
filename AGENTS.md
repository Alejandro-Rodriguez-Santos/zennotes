# Instrucciones para agentes — fork de ZenNotes

Antes de trabajar, consulta las [instrucciones vigentes](doc/AGENTS/AGENTS.md), la [lista de tareas](doc/AGENTS/TODO.md) y el seguimiento de la funcionalidad en [doc/SeguimientoAgente/](doc/SeguimientoAgente/).

Conserva las convenciones y la arquitectura de upstream descritas en [CONTRIBUTING.md](CONTRIBUTING.md) y [docs/monorepo-architecture.md](docs/monorepo-architecture.md). El directorio `docs/` sigue siendo documentación upstream; `doc/` contiene el seguimiento propio de este fork.

Al terminar un incremento, actualiza su seguimiento con cambios, verificaciones, límites y siguiente paso; mantén TODO sincronizado con el estado real. No marques como implementado un diseño o una inspección de código.

No leas directorios `ENV/`. No incluyas secretos ni documentos personales en commits, fixtures o publicaciones. No ejecutes pruebas destructivas sobre el vault real.
