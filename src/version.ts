export const VERSION = 'v43';

/** Registro de cambios visible en la app (lo más reciente primero). */
export const CHANGELOG: { v: string; d: string; t: string }[] = [
  { v: 'v43', d: '2026-11-03', t: 'Los 20 procedimientos de dolor intervencionista ahora en español, con diagnósticos en CIE-10 de la OMS y campo opcional de código CUPS (sección Códigos, oculta); las versiones en inglés siguen disponibles en su propio grupo. Copiar por sección: cada sección, cada bloque y el panel del texto final tienen su botón Copiar, para pegar en los campos de la historia clínica. Seguir en otro dispositivo: envía la nota desde el celular con un enlace y ábrela en el computador tal como la dejaste. Las acciones de cada grupo (ver otras opciones, borrar, otra opción, quitar) pasan a un menú ⋯ que ya no tapa el texto.' },
  { v: 'v42', d: '2026-11-03', t: 'Paciente nuevo (Alt+P) borra todas las notas abiertas; aviso cuando la nota tiene datos de hace rato; la nota en curso sobrevive a una recarga pero se borra al cerrar la pestaña. Al copiar con pendientes: lista para completarlos, copiar sin ellos (sin perder lo que escribiste) o copiar igual. Firma con tu perfil (nombre y registro) y campo {hora=ahora}. Botón Normal por sección, contador de pendientes por sección y bloque, y modo Pendientes. Hasta 4 veces más rápida al escribir en notas largas. En el celular: barra inferior con Siguiente, Ver nota, Paciente y Copiar, y menús como hoja inferior. Contraste accesible, tipografías incluidas (sin Google), negritas corregidas, protección ante fallas, respaldo con recordatorio y sincronización entre pestañas. Copia con formato (negritas) para historias que lo aceptan.' },
  { v: 'v41', d: '2026-11-02', t: 'Notarium pasa de artefacto a aplicación: se instala en cualquier computador o celular, funciona sin internet y se actualiza sola. Las 96 plantillas, 16 cuestionarios y las calculadoras se trasladaron sin cambios en el texto que generan (verificado automáticamente contra la versión v40). Importa tu respaldo del artefacto para traer tus plantillas propias.' },
  { v: 'v40', d: '2026-10-28', t: 'Nueva nota de examen: Mano, rizartrosis y De Quervain.' },
  { v: 'v39', d: '2026-10-22', t: 'Nuevo cuestionario: Índice de Barthel.' },
  { v: 'v38', d: '2026-10-15', t: 'Minimizar bloques insertados a una línea de resumen.' },
  { v: 'v37', d: '2026-10-15', t: 'Nuevos cuestionarios: Karnofsky (KPS) y RASS.' },
  { v: 'v36', d: '2026-10-15', t: 'Nuevo cuestionario PAINAD.' },
  { v: 'v35', d: '2026-10-15', t: 'Campos que dependen de una opción.' },
  { v: 'v30', d: '2026-10-15', t: 'Reorientación del esfuerzo terapéutico e infusiones de midazolam y fentanilo; listas con [- …].' },
  { v: 'v28', d: '2026-10-13', t: 'Revisión clínica y 30 contenidos nuevos.' },
  { v: 'v22', d: '2026-10-13', t: 'Frases y bloques unificados; pestañas Notas y Bloques.' },
  { v: 'v19', d: '2026-10-13', t: 'Notas compuestas.' },
  { v: 'v17', d: '2026-10-07', t: 'Rediseño: modos, deshacer, grupos compactos, índice y espejo.' },
  { v: 'v10', d: '2026-10-06', t: 'Ronda de dolor y paliativos con calculadora de opioides.' },
];
