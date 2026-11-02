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
