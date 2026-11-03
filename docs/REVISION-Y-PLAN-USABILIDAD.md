# Notarium v41: revisión y plan de usabilidad

Revisión hecha el 3 de noviembre de 2026 sobre la versión publicada (v41), desde tres miradas: el médico que la
usa, el desarrollador y el diseño de interfaz. Las cifras se midieron en un navegador automatizado con una
nota grande: "Evolución de ronda completa" más columna lumbar, rodilla, ESAS-r, PAINAD y hombro.

## Mediciones

| Qué | Resultado | Lectura |
|---|---|---|
| Opciones pendientes en una nota de ronda grande | **115** | Abruma; el contador deja de orientar. |
| Largo de esa hoja | **10.045 px** (unas 11 pantallas) | Mucho desplazamiento para encontrar lo pendiente. |
| Tiempo por tecla, computador normal | 16 ms | Fluido. |
| Tiempo por tecla, CPU 4 veces más lenta (equipo de hospital) | **~100 ms** | Se nota el retraso al escribir. |
| Tiempo de respuesta al tocar una opción, CPU lenta | **385 ms** | Lento: se siente pesado. |
| Fallas de contraste (axe-core, WCAG AA) | **146 elementos** | Textos ámbar, grises y tachados poco legibles. |
| Celular: alto de la barra fija | **191 px de 844** (23 %) | Queda poco espacio para la nota. |
| Celular: botones de la hoja menores de 32 px | **70 de 113** | Difíciles de tocar con precisión. |
| Celular: ancho real de la página | **457 px en pantalla de 390** | Hay desplazamiento horizontal (error). |

## 1. Como médico que la usa

**Lo que funciona bien**
- La nota sale en el lenguaje y el orden en que uno escribe; elegir es más rápido que redactar.
- Seguridad integrada: el esteroide particulado en transforaminal sale en rojo con su advertencia; las
  calculadoras recuerdan individualizar.
- La técnica habitual (aguja, contraste, esteroide) se recuerda y el lado nunca.
- Los cuestionarios redactan la interpretación, no solo el puntaje.
- No guarda datos de pacientes.

**Lo que preocupa**
1. **Datos de un paciente que pasan al siguiente.** Si cambio de plantilla y vuelvo, la nota anterior sigue
   llena: nombre, EVA, hallazgos. Solo se limpia con "Nueva nota". En una ronda de 15 pacientes es fácil
   copiar datos del paciente anterior.
2. **"Copiar igual" lleva corchetes a la historia.** Si quedan pendientes, la nota copiada contiene
   `[diagnosis]`, `[lado]`… Es un documento legal.
3. **Etiquetas cortadas en la nota.** Los grupos sin nombre salen como
   `[niega efectos adversos / náuseas / vómito / estr]`, cortados a 48 caracteres.
4. **115 pendientes** en la ronda completa: "Todo normal" ayuda en el examen, pero no hay forma de
   cerrar una sección completa ni de ver solo lo que falta.
5. **Firma fija** "Dr. Mateo Uribe Moreno" dentro de las plantillas: otra persona tendría que editar las
   96. Falta un perfil con nombre, registro médico y especialidad. Tampoco hay **hora**, que las notas
   hospitalarias exigen.
6. **Contexto colombiano.** Los procedimientos están en inglés con códigos CPT y CIE-10-CM estadounidense
   (M54.16). En Colombia se usan CUPS y la CIE-10 de la OMS (M54.1). Depende de para quién sean esas notas.
7. **En el celular, en la ronda:** la barra ocupa casi un cuarto de la pantalla, los botones son pequeños
   y el texto final solo se ve desde un menú.

## 2. Como desarrollador

**Lo que funciona bien**
- Equivalencia con el prototipo comprobada con 192 casos; 204 pruebas en total; publicación automática.
- El contenido clínico está separado del código, en archivos de texto revisables.
- Tipos estrictos; el guardado está detrás de una interfaz, listo para agregar cuentas.

**Problemas**
1. **Rendimiento:** cada tecla vuelve a dibujar la hoja entera (unos 3.700 elementos). Por eso los 100 ms y
   385 ms en equipos lentos. Los componentes leen el estado sin suscribirse a él; funciona, pero es frágil.
2. **Error:** cuando la negrita abarca un campo (`**Evolución por [servicio].**`), la hoja muestra los
   asteriscos `**` tal cual.
3. **Error:** las ventanas de opciones ocultas siguen ocupando espacio; en el celular la página se desplaza
   de lado.
4. **Sin protección ante fallas:** una plantilla propia mal escrita o un error deja la pantalla en blanco.
5. **Datos frágiles:** todo vive en el navegador. Si se borra el historial se pierden las plantillas
   propias; no hay recordatorio de respaldo; dos pestañas abiertas se sobrescriben entre sí.
6. **Pruebas de interfaz manuales:** los recorridos en navegador se hicieron a mano; no corren en cada cambio.
7. **Dependencia externa:** las tipografías vienen de Google. Es una petición a un tercero y, la primera
   vez sin internet, se ven otras letras.

## 3. Como diseño de interfaz (UI/UX)

**Lo que funciona bien**
- Un código de color claro: ámbar es pendiente, verde elegido, rojo advertencia y morado lo escrito a mano.
- Teclado completo; espejo enlazado con la nota; diseño sobrio, de "papel clínico".

**Problemas**
1. **Densidad visual:** cada grupo muestra corchetes, todas las opciones, `+`, `×` y `⇄`. En notas largas
   la vista se vuelve ruido y cuesta encontrar lo pendiente.
2. **Dos formas de elegir:** según el largo, las opciones aparecen en línea o en una ventana que pide dos
   toques. El usuario no sabe cuál le va a tocar.
3. **Íconos ambiguos y diminutos:** `+` (otra opción), `×` (quitar campo), `⇄` (alternativas) y el ojo
   tachado (ocultar párrafo) no se entienden sin explicación.
4. **Barra sobrecargada:** nueve controles. Funciones clave como guardar nota compuesta, editar o la vista
   final quedan escondidas en "Vista" y "⋯". El alcance de "Todo normal" no es evidente.
5. **Contraste:** 146 fallas, sobre todo en los textos ámbar en cursiva, los grises y lo tachado.
6. **Avisos:** la pista clínica tapa el final de la hoja y los avisos desaparecen en 3 segundos.
7. **Panel:** los nombres se cortan ("Epidural transforamina…"). No hay pantalla de inicio: siempre abre
   la última plantilla.
8. **Bienvenida:** en el celular muestra atajos de teclado que no aplican.

## Plan de mejora

Las fases están ordenadas por impacto en la seguridad y en el uso diario. Cada una tiene una meta que se
puede medir.

### Fase 0: errores visibles (1 a 2 días)
- Asteriscos `**` visibles cuando la negrita abarca un campo.
- Desplazamiento horizontal en el celular.
- Grupos sin nombre: en la nota sale `[elegir]` o el nombre de la sección, no una etiqueta cortada.
- Protección ante fallas: un error en una plantilla muestra un aviso y no deja la pantalla en blanco.
- Contraste: ajustar los colores ámbar, gris y tachado al nivel WCAG AA.

**Meta:** 0 fallas de contraste en axe, 0 desplazamiento horizontal y ningún `**` en pantalla.

### Fase 1: seguridad clínica (3 a 4 días)
- **"Paciente nuevo"**: un botón que limpia todas las notas abiertas y conserva solo la técnica recordada.
- Al copiar, ofrecer "Copiada. ¿Empezar paciente nuevo?" de forma visible y persistente.
- Indicador "nota en curso desde las 10:42" para no reutilizar sin querer la nota de otro paciente.
- **Copiar con pendientes:** mostrar la lista de lo que falta, con enlace a cada uno. Elegir entre
  "completar", "copiar sin lo pendiente" (omite las frases con corchetes) o "copiar igual".
- **Perfil del profesional:** nombre, registro médico y especialidad. Las plantillas usan `{médico}`
  y `{registro}` y no un nombre fijo.
- Campo `{hora=ahora}`.

**Meta:** ningún dato del paciente anterior en la nota siguiente y ninguna nota copiada con corchetes sin advertencia explícita.

### Fase 2: rendimiento (2 a 3 días)
- Redibujar solo el párrafo que cambió; calcular el espejo en segundo plano; dibujar las secciones
  minimizadas sin su contenido.

**Meta en CPU 4 veces más lenta:** menos de 30 ms por tecla y menos de 100 ms por opción.

### Fase 3: flujo de trabajo y menos ruido (1 semana)
- **Modo "solo pendientes":** atenúa lo completo y salta de pendiente en pendiente. Hoy existe con Tab,
  pero sin ayuda visual.
- **Secciones que se pliegan solas al completarse,** con resumen de una línea, como los bloques minimizados.
- **"Normal" por sección y por bloque,** no solo para toda la nota.
- **Una sola forma de elegir:** pastilla con la opción elegida y menú al tocar, igual para grupos cortos y
  largos. Los grupos de 2 o 3 opciones cortas pueden seguir en línea.
- **Íconos con texto o etiqueta emergente clara;** quitar `⇄` y llevar "otra opción" y "quitar campo" al menú del grupo.
- **Barra simplificada:** título, progreso, Copiar y un menú. Deshacer queda en el teclado y en el menú.
- **Pantalla de inicio:** favoritas, recientes, notas compuestas y "Paciente nuevo".

**Meta:** completar una evolución de ronda con examen en menos de 2 minutos y menos de 40 toques.

### Fase 4: celular y tableta (3 a 4 días)
- Barra superior de una línea; **barra inferior fija** con "Siguiente pendiente", "Ver nota" y "Copiar".
- Botones de al menos 40 px; menús de opciones como hoja inferior a pantalla completa.
- "Ver nota" abre el texto final en una hoja deslizable.
- Bienvenida táctil, sin atajos de teclado.

**Meta:** barra fija de menos de 110 px y 0 botones menores de 40 px.

### Fase 5: funciones del prototipo que faltan (1 semana)
- Modo **Escribir** (corregir el texto fijo), modo **Borrar** (borrador por palabra), convertir selección
  en opciones o campo, `/` dentro del texto libre y editor de notas compuestas.

### Fase 6: datos seguros (2 a 3 días; las cuentas, aparte)
- Recordatorio de respaldo semanal y respaldo automático descargable.
- Sincronización entre pestañas abiertas.
- Tipografías incluidas en la app, sin Google.
- Pruebas de interfaz en el navegador dentro de la integración continua.
- Más adelante, para varios usuarios: cuentas y sincronización entre dispositivos.

### Fase 7: contenido para el contexto local (según tu decisión)
- Versiones en español de los procedimientos y/o códigos CUPS y CIE-10 OMS.
- Revisión de las etiquetas de los grupos sin nombre.

## Decisiones que necesito del usuario

1. ¿Las notas de procedimientos deben seguir en inglés (CPT, CIE-10-CM), pasar a español (CUPS, CIE-10)
   o existir en ambos idiomas?
2. ¿En qué sistema de historia clínica pegas las notas? ¿Respeta saltos de línea y listas? Así se define
   el formato de copiado.
3. ¿Usas Notarium más en computador o en celular durante la ronda? Así se decide si va primero la fase 3 o la 4.
