/** Cuestionarios y escalas con puntaje e interpretación. */
import type { QuestValue } from '../engine/types';
import { joinList } from './format';

export type QuestItem =
  | { l: string; t: 'yn' }
  | { l: string; t: 'num'; max: number }
  | { l: string; t: 'opt'; o: { l: string; v: number }[] };

export interface Questionnaire {
  name: string;
  note?: string;
  items: QuestItem[];
  score(v: QuestValue, q: Questionnaire): { short: string; text: string };
}

const YN = { t: 'yn' as const };
const LIK4 = ['Nunca', 'Varios días', 'Más de la mitad de los días', 'Casi todos los días'];
const PDL = ['Nunca', 'Casi nunca', 'Levemente', 'Moderadamente', 'Fuertemente', 'Muy fuertemente'];
const pct = (x: number) => Math.round(x * 10) / 10;
const ans = (v?: QuestValue) => (v && v.a) || {};
export const answered = (v: QuestValue | undefined, q: Questionnaire) => q.items.filter((_, i) => ans(v)[i] != null).length;
const sumA = (v: QuestValue, q: Questionnaire, idx?: number[]) =>
  (idx || q.items.map((_, i) => i)).reduce((s, i) => s + (ans(v)[i] != null ? +ans(v)[i] : 0), 0);
const incomplete = (v: QuestValue, q: Questionnaire) => {
  const a = answered(v, q), m = q.items.length;
  return a < m ? ` (${a} de ${m} ítems respondidos)` : '';
};
const opts = (labels: string[]) => labels.map((l, v) => ({ l, v }));
const opt = (l: string, o: { l: string; v: number }[]): QuestItem => ({ l, t: 'opt', o });
const numI = (l: string, max: number): QuestItem => ({ l, t: 'num', max });
const yn = (l: string): QuestItem => ({ l, ...YN });
const NONE = { short: '', text: '' };
/** Escalas de una sola opción: "ECOG 2: ambulatorio…". */
function single(prefix: (x: number) => string, short: (x: number) => string, desc: (l: string) => string) {
  return (v: QuestValue, q: Questionnaire) => {
    const x = ans(v)[0];
    if (x == null) return NONE;
    const it = q.items[0] as Extract<QuestItem, { t: 'opt' }>;
    const o = it.o.find((o) => o.v == x)!;
    return { short: short(x), text: `${prefix(x)}: ${desc(o.l)}.` };
  };
}
const afterColon = (l: string) => l.split(': ')[1];

export const QUESTS: Record<string, Questionnaire> = {
  dn4: {
    name: 'DN4 (dolor neuropático)',
    items: ['Ardor o quemazón', 'Sensación de frío doloroso', 'Descargas eléctricas', 'Hormigueo', 'Pinchazos', 'Entumecimiento', 'Picazón',
      'Examen: hipoestesia al tacto', 'Examen: hipoestesia al pinchazo', 'Examen: dolor provocado por el cepillado'].map(yn),
    score(v, q) {
      const s = sumA(v, q);
      const pos = q.items.filter((_, i) => ans(v)[i] == 1).map((x) => x.l.replace('Examen: ', '').toLowerCase());
      return {
        short: `${s}/10`,
        text: `DN4 ${s}/10${incomplete(v, q)}${pos.length ? ` (positivo: ${joinList(pos, 'es')})` : ''}; ${s >= 4 ? 'sugiere dolor neuropático' : 'no sugiere dolor neuropático'}.`,
      };
    },
  },
  pdq: {
    name: 'painDETECT',
    items: [
      ...['Ardor', 'Hormigueo o sensación de hormigas', 'Dolor con el roce leve de la ropa o sábanas', 'Ataques de dolor tipo descarga eléctrica',
        'Dolor con el frío o el calor', 'Entumecimiento', 'Dolor con presión leve'].map((l) => opt(l, opts(PDL))),
      opt('Patrón del dolor', [
        { l: 'Persistente con leves fluctuaciones', v: 0 }, { l: 'Persistente con ataques de dolor', v: -1 },
        { l: 'Ataques sin dolor entre ellos', v: 1 }, { l: 'Ataques con dolor entre ellos', v: 1 }]),
      opt('Dolor irradiado', [{ l: 'No', v: 0 }, { l: 'Sí', v: 2 }]),
    ],
    score(v, q) {
      const s = sumA(v, q);
      const i = s <= 12 ? 'componente neuropático poco probable' : s <= 18 ? 'resultado ambiguo; puede existir componente neuropático' : 'componente neuropático probable';
      return { short: `${s}/38`, text: `painDETECT ${s}/38${incomplete(v, q)}: ${i}.` };
    },
  },
  bpi: {
    name: 'Inventario Breve de Dolor (BPI)',
    items: [
      ...['Peor dolor en las últimas 24 horas', 'Menor dolor en las últimas 24 horas', 'Dolor promedio', 'Dolor en este momento'].map((l) => numI(l, 10)),
      ...['Actividad general', 'Estado de ánimo', 'Capacidad para caminar', 'Trabajo habitual', 'Relaciones con otras personas', 'Sueño', 'Disfrutar de la vida']
        .map((l) => numI('Interferencia: ' + l.toLowerCase(), 10)),
    ],
    score(v, q) {
      const a = ans(v);
      const sev = [0, 1, 2, 3].filter((i) => a[i] != null), inf = [4, 5, 6, 7, 8, 9, 10].filter((i) => a[i] != null);
      const ms = sev.length ? pct(sev.reduce((s, i) => s + +a[i], 0) / sev.length) : null;
      const mi = inf.length ? pct(inf.reduce((s, i) => s + +a[i], 0) / inf.length) : null;
      const f = (x: number) => String(x).replace('.', ',');
      return {
        short: `${ms != null ? 'Intensidad ' + f(ms) : ''}${mi != null ? (ms != null ? '; ' : '') + 'Interferencia ' + f(mi) : ''}`,
        text: `Inventario Breve de Dolor${incomplete(v, q)}: ${ms != null ? `intensidad promedio ${f(ms)}/10 (peor ${a[0] ?? '-'}, menor ${a[1] ?? '-'}, promedio ${a[2] ?? '-'}, actual ${a[3] ?? '-'})` : 'intensidad sin responder'}; ${mi != null ? `interferencia promedio ${f(mi)}/10` : 'interferencia sin responder'}.`,
      };
    },
  },
  esas: {
    name: 'ESAS-r (síntomas, paliativos)',
    items: ['Dolor', 'Cansancio', 'Somnolencia', 'Náuseas', 'Falta de apetito', 'Disnea', 'Depresión', 'Ansiedad', 'Malestar general'].map((l) => numI(l, 10)),
    score(v, q) {
      const a = ans(v);
      const r = q.items.map((x, i) => (a[i] != null ? { n: x.l.toLowerCase(), s: +a[i] } : null)).filter((x): x is { n: string; s: number } => !!x);
      const sv = r.filter((x) => x.s >= 7).map((x) => x.n), md = r.filter((x) => x.s >= 4 && x.s < 7).map((x) => x.n);
      const tot = r.reduce((s, x) => s + x.s, 0);
      return {
        short: `Total ${tot}/90`,
        text: `ESAS-r${incomplete(v, q)}: ${r.map((x) => `${x.n} ${x.s}`).join(', ')}; puntaje total ${tot}/90. ${sv.length ? `Síntomas severos (7 o más): ${joinList(sv, 'es')}. ` : ''}${md.length ? `Síntomas moderados (4 a 6): ${joinList(md, 'es')}.` : ''}${!sv.length && !md.length ? 'Sin síntomas moderados ni severos.' : ''}`.trim(),
      };
    },
  },
  pps: {
    name: 'Palliative Performance Scale (PPS)',
    items: [opt('Nivel según deambulación, actividad, autocuidado, ingesta y conciencia', [
      { l: '100%: deambulación completa, actividad normal, sin evidencia de enfermedad', v: 100 },
      { l: '90%: deambulación completa, actividad normal, alguna evidencia de enfermedad', v: 90 },
      { l: '80%: deambulación completa, actividad normal con esfuerzo', v: 80 },
      { l: '70%: deambulación reducida, incapaz de trabajar', v: 70 },
      { l: '60%: deambulación reducida, ayuda ocasional en autocuidado', v: 60 },
      { l: '50%: principalmente sentado o acostado, ayuda considerable', v: 50 },
      { l: '40%: principalmente en cama, asistencia en la mayoría de actividades', v: 40 },
      { l: '30%: postrado en cama, cuidado total', v: 30 },
      { l: '20%: postrado, ingesta mínima a sorbos', v: 20 },
      { l: '10%: postrado, solo cuidados de boca, somnoliento o en coma', v: 10 },
      { l: '0%: fallecido', v: 0 }])],
    score: single((x) => `PPS ${x}%`, (x) => `${x}%`, afterColon),
  },
  ecog: {
    name: 'ECOG',
    items: [opt('Estado funcional', [
      { l: '0: completamente activo, sin restricciones', v: 0 },
      { l: '1: restricción en actividad extenuante, ambulatorio, trabajo liviano', v: 1 },
      { l: '2: ambulatorio y autocuidado, incapaz de trabajar, en pie más del 50% del día', v: 2 },
      { l: '3: autocuidado limitado, en cama o silla más del 50% del día', v: 3 },
      { l: '4: totalmente incapacitado, confinado a cama o silla', v: 4 }])],
    score: single((x) => `ECOG ${x}`, (x) => `ECOG ${x}`, afterColon),
  },
  odi: {
    name: 'Índice de discapacidad de Oswestry (ODI)',
    note: 'Ingresa el puntaje de 0 a 5 de cada sección del formulario diligenciado por el paciente.',
    items: ['Intensidad del dolor', 'Cuidado personal', 'Levantar peso', 'Caminar', 'Estar sentado', 'Estar de pie', 'Dormir', 'Vida sexual', 'Vida social', 'Viajar'].map((l) => numI(l, 5)),
    score(v, q) {
      const a = answered(v, q);
      if (!a) return NONE;
      const p = Math.round(sumA(v, q) / (5 * a) * 100);
      const c = p <= 20 ? 'discapacidad mínima' : p <= 40 ? 'discapacidad moderada' : p <= 60 ? 'discapacidad severa' : p <= 80 ? 'discapacidad muy severa' : 'paciente postrado o con exageración de síntomas';
      return { short: `${p}%`, text: `Índice de discapacidad de Oswestry ${p}%${a < 10 ? ` (${a} de 10 secciones respondidas)` : ''}: ${c}.` };
    },
  },
  ndi: {
    name: 'Neck Disability Index (NDI)',
    note: 'Ingresa el puntaje de 0 a 5 de cada sección del formulario diligenciado por el paciente.',
    items: ['Intensidad del dolor', 'Cuidado personal', 'Levantar peso', 'Lectura', 'Cefalea', 'Concentración', 'Trabajo', 'Conducir', 'Dormir', 'Recreación'].map((l) => numI(l, 5)),
    score(v, q) {
      const a = answered(v, q);
      if (!a) return NONE;
      const s = sumA(v, q), p = Math.round(s / (5 * a) * 100), s50 = a < 10 ? Math.round(p / 2) : s;
      const c = s50 <= 4 ? 'sin discapacidad' : s50 <= 14 ? 'discapacidad leve' : s50 <= 24 ? 'discapacidad moderada' : s50 <= 34 ? 'discapacidad severa' : 'discapacidad completa';
      return { short: `${s50}/50`, text: `Neck Disability Index ${s50}/50 (${p}%)${a < 10 ? `, con ${a} de 10 secciones respondidas` : ''}: ${c}.` };
    },
  },
  stopbang: {
    name: 'STOP-Bang (apnea del sueño)',
    items: ['Ronquido fuerte', 'Cansancio o somnolencia diurna', 'Apneas observadas durante el sueño', 'Hipertensión arterial', 'IMC mayor de 35 kg/m²',
      'Edad mayor de 50 años', 'Circunferencia de cuello mayor de 40 cm', 'Sexo masculino'].map(yn),
    score(v, q) {
      const s = sumA(v, q), r = s <= 2 ? 'bajo' : s <= 4 ? 'intermedio' : 'alto';
      return { short: `${s}/8`, text: `STOP-Bang ${s}/8${incomplete(v, q)}: riesgo ${r} de apnea obstructiva del sueño.` };
    },
  },
  ort: {
    name: 'Opioid Risk Tool (ORT-OUD)',
    items: ['Antecedente familiar de abuso de alcohol', 'Antecedente familiar de abuso de drogas ilícitas', 'Antecedente familiar de abuso de medicamentos de prescripción',
      'Antecedente personal de abuso de alcohol', 'Antecedente personal de abuso de drogas ilícitas', 'Antecedente personal de abuso de medicamentos de prescripción',
      'Edad entre 16 y 45 años', 'Enfermedad psiquiátrica: TDAH, TOC, trastorno bipolar o esquizofrenia', 'Depresión'].map(yn),
    score(v, q) {
      const s = sumA(v, q);
      return { short: `${s}/9`, text: `Opioid Risk Tool (ORT-OUD) ${s}/9${incomplete(v, q)}: ${s >= 3 ? 'riesgo alto' : 'riesgo bajo'} de trastorno por uso de opioides.` };
    },
  },
  phq4: {
    name: 'PHQ-4 (ansiedad y depresión)',
    items: ['Nervioso, ansioso o con los nervios de punta', 'No poder dejar de preocuparse', 'Poco interés o placer en hacer las cosas', 'Desanimado, deprimido o sin esperanza']
      .map((l) => opt(l, opts(LIK4))),
    score(v, q) {
      const g = sumA(v, q, [0, 1]), p = sumA(v, q, [2, 3]), s = g + p;
      const sev = s <= 2 ? 'normal' : s <= 5 ? 'leve' : s <= 8 ? 'moderado' : 'severo';
      const pos = [g >= 3 ? 'ansiedad' : null, p >= 3 ? 'depresión' : null].filter((x): x is string => !!x);
      return {
        short: `${s}/12`,
        text: `PHQ-4 ${s}/12${incomplete(v, q)}, malestar psicológico ${sev} (GAD-2 ${g}/6, PHQ-2 ${p}/6); tamizaje ${pos.length ? 'positivo para ' + joinList(pos, 'es') : 'negativo para ansiedad y depresión'}.`,
      };
    },
  },
  painad: {
    name: 'PAINAD (dolor en paciente no comunicativo)',
    note: 'Observa al paciente durante 3 a 5 minutos, en reposo y durante la movilización o el cuidado.',
    items: [
      opt('Respiración (independiente de la vocalización)', [{ l: '0: normal', v: 0 }, { l: '1: ocasionalmente dificultosa o periodos cortos de hiperventilación', v: 1 }, { l: '2: ruidosa y dificultosa, hiperventilación prolongada o respiración de Cheyne-Stokes', v: 2 }]),
      opt('Vocalización negativa', [{ l: '0: ninguna', v: 0 }, { l: '1: quejidos o gemidos ocasionales, habla baja con tono negativo', v: 1 }, { l: '2: llamados repetidos de angustia, quejidos fuertes o llanto', v: 2 }]),
      opt('Expresión facial', [{ l: '0: sonriente o inexpresiva', v: 0 }, { l: '1: triste, asustada o con ceño fruncido', v: 1 }, { l: '2: muecas de dolor', v: 2 }]),
      opt('Lenguaje corporal', [{ l: '0: relajado', v: 0 }, { l: '1: tenso, inquieto, se frota', v: 1 }, { l: '2: rígido, puños cerrados, rodillas flexionadas, se aparta, empuja o golpea', v: 2 }]),
      opt('Consolabilidad', [{ l: '0: no necesita consuelo', v: 0 }, { l: '1: se distrae o tranquiliza con la voz o el contacto', v: 1 }, { l: '2: no se consuela ni se distrae', v: 2 }]),
    ],
    score(v, q) {
      const s = sumA(v, q);
      const c = s === 0 ? 'sin dolor observable' : s <= 3 ? 'dolor leve' : s <= 6 ? 'dolor moderado' : 'dolor severo';
      const a = ans(v);
      const hi = q.items.filter((_, i) => a[i] != null && +a[i] > 0).map((x) => x.l.split(' (')[0].toLowerCase());
      return { short: `${s}/10`, text: `PAINAD ${s}/10${incomplete(v, q)}: ${c}${hi.length ? ` (puntúan: ${joinList(hi, 'es')})` : ''}.` };
    },
  },
  kps: {
    name: 'Karnofsky (KPS)',
    items: [opt('Estado funcional', [
      { l: '100%: normal, sin quejas ni evidencia de enfermedad', v: 100 },
      { l: '90%: capaz de actividad normal; signos o síntomas menores', v: 90 },
      { l: '80%: actividad normal con esfuerzo; algunos signos o síntomas', v: 80 },
      { l: '70%: cuida de sí mismo; incapaz de actividad normal o de trabajar', v: 70 },
      { l: '60%: requiere asistencia ocasional; cubre la mayoría de sus necesidades', v: 60 },
      { l: '50%: requiere asistencia considerable y cuidados médicos frecuentes', v: 50 },
      { l: '40%: incapacitado; requiere cuidados y asistencia especiales', v: 40 },
      { l: '30%: severamente incapacitado; hospitalización indicada aunque la muerte no es inminente', v: 30 },
      { l: '20%: muy enfermo; requiere hospitalización y tratamiento de soporte activo', v: 20 },
      { l: '10%: moribundo', v: 10 },
      { l: '0%: fallecido', v: 0 }])],
    score: single((x) => `Karnofsky ${x}%`, (x) => `KPS ${x}%`, afterColon),
  },
  rass: {
    name: 'RASS (agitación y sedación)',
    items: [opt('Nivel', [
      { l: '+4 combativo: violento, peligro inmediato para el personal', v: 4 },
      { l: '+3 muy agitado: se retira tubos o catéteres, agresivo', v: 3 },
      { l: '+2 agitado: movimientos frecuentes sin propósito', v: 2 },
      { l: '+1 inquieto: ansioso, movimientos no agresivos', v: 1 },
      { l: '0 alerta y tranquilo', v: 0 },
      { l: '-1 somnoliento: despierta a la voz y mantiene contacto visual más de 10 segundos', v: -1 },
      { l: '-2 sedación leve: despierta brevemente a la voz, contacto visual menos de 10 segundos', v: -2 },
      { l: '-3 sedación moderada: se mueve o abre los ojos a la voz, sin contacto visual', v: -3 },
      { l: '-4 sedación profunda: sin respuesta a la voz; se mueve o abre los ojos a la estimulación física', v: -4 },
      { l: '-5 no despertable: sin respuesta a la voz ni a la estimulación física', v: -5 }])],
    score(v, q) {
      const x = ans(v)[0];
      if (x == null) return NONE;
      const it = q.items[0] as Extract<QuestItem, { t: 'opt' }>;
      const o = it.o.find((o) => o.v == x)!;
      const s = x > 0 ? '+' + x : String(x), d = o.l.replace(/^[+-]?\d\s*/, '');
      return { short: `RASS ${s}`, text: `RASS ${s}: ${d}.` };
    },
  },
  barthel: {
    name: 'Índice de Barthel',
    items: [
      opt('Alimentación', [{ l: '10: independiente', v: 10 }, { l: '5: necesita ayuda para cortar o untar', v: 5 }, { l: '0: dependiente', v: 0 }]),
      opt('Baño', [{ l: '5: independiente', v: 5 }, { l: '0: dependiente', v: 0 }]),
      opt('Aseo personal', [{ l: '5: independiente para lavarse la cara, peinarse y afeitarse', v: 5 }, { l: '0: dependiente', v: 0 }]),
      opt('Vestirse', [{ l: '10: independiente', v: 10 }, { l: '5: necesita ayuda, hace la mitad solo', v: 5 }, { l: '0: dependiente', v: 0 }]),
      opt('Deposiciones', [{ l: '10: continente', v: 10 }, { l: '5: incontinencia ocasional', v: 5 }, { l: '0: incontinente', v: 0 }]),
      opt('Micción', [{ l: '10: continente', v: 10 }, { l: '5: incontinencia ocasional', v: 5 }, { l: '0: incontinente o con sonda sin manejo propio', v: 0 }]),
      opt('Uso del retrete', [{ l: '10: independiente', v: 10 }, { l: '5: necesita alguna ayuda', v: 5 }, { l: '0: dependiente', v: 0 }]),
      opt('Traslado cama y silla', [{ l: '15: independiente', v: 15 }, { l: '10: mínima ayuda o supervisión', v: 10 }, { l: '5: gran ayuda, pero puede sentarse', v: 5 }, { l: '0: dependiente', v: 0 }]),
      opt('Deambulación', [{ l: '15: independiente más de 50 metros', v: 15 }, { l: '10: con ayuda de una persona más de 50 metros', v: 10 }, { l: '5: independiente en silla de ruedas', v: 5 }, { l: '0: inmóvil', v: 0 }]),
      opt('Subir y bajar escaleras', [{ l: '10: independiente', v: 10 }, { l: '5: necesita ayuda o supervisión', v: 5 }, { l: '0: incapaz', v: 0 }]),
    ],
    score(v, q) {
      const s = sumA(v, q);
      const c = s === 100 ? 'independiente' : s >= 60 ? 'dependencia leve' : s >= 40 ? 'dependencia moderada' : s >= 20 ? 'dependencia grave' : 'dependencia total';
      const a = ans(v);
      const lim = q.items.map((x, i) => {
        const it = x as Extract<QuestItem, { t: 'opt' }>;
        return a[i] != null && +a[i] < +it.o[0].v ? x.l.toLowerCase() : null;
      }).filter((x): x is string => !!x);
      return { short: `${s}/100`, text: `Índice de Barthel ${s}/100${incomplete(v, q)}: ${c}${lim.length ? ` (requiere ayuda en: ${joinList(lim, 'es')})` : ''}.` };
    },
  },
  cam: {
    name: 'CAM (delirium)',
    items: ['1. Inicio agudo y curso fluctuante', '2. Inatención', '3. Pensamiento desorganizado', '4. Nivel de conciencia alterado'].map(yn),
    score(v, q) {
      const a = ans(v);
      if (!answered(v, q)) return NONE;
      const pos = a[0] == 1 && a[1] == 1 && (a[2] == 1 || a[3] == 1);
      return { short: pos ? 'Positivo' : 'Negativo', text: `Método de evaluación de la confusión (CAM)${incomplete(v, q)}: ${pos ? 'positivo para delirium' : 'negativo para delirium'}.` };
    },
  },
};

export function questText(qid: string | undefined, v: QuestValue | undefined): string {
  const q = qid ? QUESTS[qid] : undefined;
  return q && v && v.a && Object.keys(v.a).length ? q.score(v, q).text : '';
}
