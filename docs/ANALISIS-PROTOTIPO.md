# Notarium — análisis del prototipo (artefacto)

Fuentes leídas (copiadas en `legacy/`):

| Artefacto | Versión | Canal | Fecha | Tamaño |
|---|---|---|---|---|
| Notarium (pruebas) — claude.ai/artifact/DJbpkw65xjaebKhMU3S1BZ | v40 | pruebas | 2026-10-28 | 3092 líneas, 329 KB |
| Notarium — claude.ai/artifact/GZMTq6bXozwUuLTsMLLWfR | v18 | producción | 2026-10-07 | 2103 líneas, 206 KB |

La versión **v40 (pruebas)** es la referencia: contiene todo lo de v18 y 22 versiones más.
Ningún artefacto tiene comentarios abiertos.

## Qué es

Generador de notas clínicas por plantillas para anestesiología, medicina del dolor y cuidados paliativos.
El médico elige una plantilla, toca opciones dentro del texto, rellena campos y copia la nota terminada
para pegarla en la historia clínica. No guarda datos de pacientes: solo plantillas y preferencias.

## Contenido clínico incluido (≈90 plantillas y bloques)

- **Dolor intervencionista (inglés):** TFESI, ILESI, MBB y RFA lumbar, RF genicular, epidurales cervicales IL/TF,
  MBB y RFA cervical, sacroilíaca, RF de ramos laterales sacros, PRP, SCS (trial, implante, seguimiento),
  neurólisis celíaca e hipogástrica, ganglio estrellado, occipitales, RF pulsada, puntos gatillo.
- **Anestesia (español):** general, sedación, neuroaxial, nervio periférico, bloqueo regional, valoración
  preanestésica, tiempos anestésicos, salida de URPA, evento adverso, calculadora de anestésico local.
- **Ronda de dolor y paliativos:** SOAP, análisis, plan, dosis de opioide, examen físico, interconsulta,
  sedación paliativa (y su evolución), reunión familiar, control de síntomas, PCA/infusión SC, catéteres,
  reorientación del esfuerzo terapéutico, órdenes de enfermería de midazolam y fentanilo.
- **Examen físico por región (15):** columna cervical/torácica/lumbar, SI, cadera, rodilla, pie, hombro,
  codo-mano, rizartrosis/De Quervain, ATM, pared abdominal, neuropático, SDRC, miofascial.
- **Consulta e historia clínica (15 bloques)** + consentimiento, opioides crónicos, instrucciones de egreso.
- **Cuestionarios con puntaje (16):** DN4, painDETECT, BPI, ESAS-r, PPS, ECOG, ODI, NDI, STOP-Bang, ORT-OUD,
  PHQ-4, PAINAD, KPS, RASS, Barthel, CAM.
- **Calculadoras:** conversión de opioides (MME, reducción por tolerancia cruzada, rescate) y dosis
  máxima de anestésico local por peso.
- **Notas compuestas incluidas:** primera vez, control y ronda.

## Funciones de la aplicación

- Panel con pestañas Notas/Bloques, búsqueda, favoritas, recientes, grupos plegables; "Nota libre" (Alt+N).
- Hoja con tres modos: **Elegir**, **Escribir** (edición del texto literal) y **Borrar** (borrador por palabra/unidad).
- Opciones inline o compactas en ventana emergente; opciones con advertencia; selección múltiple con
  opción excluyente; campos dependientes de una opción; campos "recordados" (sticky) entre notas.
- Secciones y párrafos ocultables; índice de secciones con pendientes; barra de progreso.
- Bloques insertables en cualquier punto (paleta con búsqueda, menú `/`), mover, duplicar, minimizar.
- Espejo de texto plano enlazado con la hoja; copiar (Ctrl+Enter); deshacer/rehacer (80 pasos).
- Convertir texto seleccionado en opciones o en campo; guardar como frase.
- Editor de plantillas propias con un **mini‑lenguaje** y vista previa; sobrescribir plantillas incluidas.
- Respaldo JSON exportar/importar (combinar o reemplazar), registro de cambios.
- Sincronización: `localStorage` (`notarium:v2:`) + base de datos del artefacto por usuario
  (`data/users/<uid>/settings` y `/custom`).
- Navegación completa por teclado, modo oscuro, diseño móvil.

### Mini‑lenguaje de plantillas (formato fuente que hay que conservar)

```
## Sección (oculta)          sección; "(oculta)" arranca apagada
[a / b]                       opción única
[nombre: a / b] … {nombre}    opción con nombre y repetición
[* a / b]   [- a / b]         múltiple (unida con comas/"y") o en lista con guiones
[* 0 normal / x / y]          0 = opción excluyente
[!opción]                     opción con advertencia
[sin bolo / dar {dosis} mg]   campo que solo existe si se elige esa opción
{campo}  {fecha=hoy}  {médico=Dr. …}   campo de texto, con valor por defecto
[@aguja: 22 G / 25 G]  {@médico}       recordar elección
[#opioides] [%anestésicos] [?dn4]      calculadora de opioides / AL / cuestionario
**Subtítulo**   **Negrita:**
```

Las plantillas incluidas usan internamente un modelo `{vars, sections[{id,title,blocks[]}], sticky}`
con tokens `{{clave|cap}}`; `builtinToSource()` las convierte al mini‑lenguaje y `parseSource()` hace lo inverso.

## Datos del usuario hoy en la nube del artefacto

- Producción (v18): plantilla propia "Preanestesia" y una versión propia de "Radiofrecuencia genicular".
- Pruebas (v40): notas compuestas "Ronda Mía paliativos" y "Análisis reorientación", y versión propia de "Examen físico".

Hay que migrarlos a la nueva app (el formato de respaldo `{app:"notarium",format:1,settings,custom}` sirve de puente).

## Deuda técnica a resolver al pasar a aplicación

- Un único HTML de ~3000 líneas: CSS, contenido clínico, motor y UI mezclados; estado global mutable,
  re-render completo con `innerHTML` en cada cambio.
- El contenido clínico está en código JS; debería estar en datos (el mini‑lenguaje) y versionado aparte.
- Dos formatos de plantilla (interno y fuente) con conversión ida y vuelta: unificar en uno.
- Código muerto (p. ej. `isAbn()` retorna `false` en la primera instrucción) y migraciones ad hoc (`migrateVis24`, `migrateSnips`).
- Sin pruebas automatizadas; las calculadoras y puntajes clínicos necesitan pruebas unitarias.
- Persistencia acoplada al runtime de artefactos (`window.claude.use("db")`).

---

# Estado de la migración (v41)

## Decisiones

| Tema | Decisión | Por qué |
|---|---|---|
| Plataforma | Aplicación web instalable (PWA) en GitHub Pages | Abre en cualquier computador o celular sin instalar nada; se puede instalar como app; funciona sin internet; publicación gratuita y automática. |
| Tecnología | TypeScript + React + Vite, pruebas con Vitest | Estándar, con tipos que evitan errores, fácil de mantener y de ampliar. |
| Plantillas | Un archivo `.md` por plantilla en `content/templates/`, con el mini-lenguaje como único formato | El contenido clínico queda separado del código y se revisa como texto. |
| Datos | Navegador (localStorage) detrás de una interfaz `StorageBackend` | Hoy es un solo usuario; para varios usuarios se agrega un servidor con cuentas sin tocar la interfaz. |
| Compatibilidad | Mismo formato de respaldo que el artefacto | Tus plantillas, versiones propias y notas compuestas se importan directo. |

## Garantía de equivalencia

`tools/extract-legacy.cjs` abre el prototipo v40 en un navegador sin pantalla, exporta sus 96 plantillas
y genera el texto de cada una en dos escenarios (todo vacío y todo lleno). `src/engine/golden.test.ts`
comprueba que el motor nuevo produce exactamente el mismo texto: 192 casos idénticos.

Extensiones del mini-lenguaje necesarias para no perder información del prototipo:

- `(? pista)` al final de una opción y `?? pista` como última opción del grupo (29 pistas clínicas).
- `^` / `~` para forzar o evitar la mayúscula inicial (9 plantillas).
- `order:` en el encabezado para conservar el orden del panel.

## Funciones ya portadas

Panel con Notas/Bloques, búsqueda, favoritas, recientes y grupos plegables; nota libre; opciones en línea y
compactas; selección múltiple con excluyentes; campos dentro de opciones; pistas y advertencias; elecciones
recordadas (@); ocultar secciones y párrafos; quitar campos; bloques y textos insertados (mover, duplicar,
minimizar, quitar); paleta de inserción y tecla `/`; notas compuestas (incluidas, guardar, actualizar, eliminar);
"Todo normal"; índice de secciones y barra de progreso; espejo enlazado; vista final; copiar con aviso de pendientes;
deshacer/rehacer; atajos de teclado; editor con vista previa, versiones propias de incluidas y restaurar original;
respaldo exportar/importar (combinar o reemplazar); calculadoras de opioides y anestésico local; 16 cuestionarios;
tema claro/oscuro; diseño móvil; funcionamiento sin conexión y aviso de versión nueva.

## Pendiente respecto al prototipo

1. Modo **Escribir**: editar a mano el texto fijo de un párrafo (el motor ya lo soporta con `lit`; falta la interfaz).
2. Modo **Borrar**: borrador por palabra o arrastrando.
3. Convertir texto seleccionado en opciones o en campo, y "Guardar como frase".
4. Menú `/` mientras se escribe dentro de un texto libre.
5. Editor dedicado de notas compuestas (renombrar y reordenar bloques; hoy se rearman desde la nota).

## Siguientes etapas propuestas

- Cuentas y sincronización entre dispositivos (p. ej. Supabase) cuando haya más usuarios.
- Biblioteca compartida de plantillas por servicio o equipo.
