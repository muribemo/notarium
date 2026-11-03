# Notarium

Notas clínicas por plantillas para anestesiología, medicina del dolor y cuidados paliativos.
Eliges una plantilla, tocas las opciones dentro del texto, llenas los campos y copias la nota
para pegarla en la historia clínica. **No guarda datos de pacientes.**

Es una aplicación web instalable (PWA): abre en cualquier navegador moderno, se puede instalar
en Windows, Mac, Linux, Android o iPhone ("Instalar app" / "Agregar a pantalla de inicio") y
funciona sin internet una vez abierta.

## Contenido

- 96 plantillas y bloques: dolor intervencionista, anestesia, ronda de dolor y paliativos,
  consulta e historia clínica, examen físico por región y 16 cuestionarios con puntaje.
- Calculadoras de equivalencia de opioides y de dosis máxima de anestésico local.
- Plantillas propias con un mini-lenguaje sencillo, notas compuestas, respaldo exportable.

## Estructura

```
content/templates/<grupo>/<id>.md   plantillas incluidas (encabezado + mini-lenguaje)
content/combos.json                 notas compuestas incluidas
src/engine/                         intérprete de plantillas y generación del texto
src/clinical/                       calculadoras y cuestionarios
src/state/                          catálogo, guardado y estado de la app
src/ui/                             interfaz (React)
legacy/                             prototipo original (artefacto v40 y v18), solo referencia
tools/extract-legacy.cjs            extrae las plantillas del prototipo y los textos de referencia
```

### Formato de una plantilla

```
---
id: x_hom
name: Hombro
short: HOM
group: Examen físico por región
lang: es
use: ambos          # nota | bloque | ambos
insert: seccion     # seccion | texto
normal: true        # botón "Todo normal"
---
## Inspección
**Hombro** [lado: derecho / izquierdo]

**Inspección:** [trofismo: sin atrofias / con atrofia del deltoides (? pista opcional)].
```

La sintaxis completa está en `src/engine/parse.ts` y en la ayuda del editor dentro de la app.

## Desarrollo

```
npm install
npm run dev        # servidor local
npm test           # pruebas (incluye equivalencia con el prototipo en las 96 plantillas)
npm run build      # versión de producción en dist/
```

## Publicación

Cada cambio en `main` se publica solo en GitHub Pages (`.github/workflows/deploy.yml`).
Requisito único: en GitHub, *Settings → Pages → Source: GitHub Actions*.
