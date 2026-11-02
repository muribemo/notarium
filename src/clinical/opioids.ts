/**
 * Calculadora de equivalencia de opioides (EMM: equivalente de morfina oral en 24 h)
 * y rotación con reducción por tolerancia cruzada incompleta.
 * Factores de referencia: CDC 2022 y tablas equianalgésicas habituales.
 */
import type { OpioidValue } from '../engine/types';
import { fmt, num } from './format';

export interface Opioid { id: string; n: string; u: string; f: number; noTarget?: boolean }

export const OPIOIDS: Opioid[] = [
  { id: 'mor_vo', n: 'morfina VO', u: 'mg/día', f: 1 },
  { id: 'mor_iv', n: 'morfina IV/SC', u: 'mg/día', f: 3 },
  { id: 'oxi_vo', n: 'oxicodona VO', u: 'mg/día', f: 1.5 },
  { id: 'hm_vo', n: 'hidromorfona VO', u: 'mg/día', f: 5 },
  { id: 'hm_iv', n: 'hidromorfona IV/SC', u: 'mg/día', f: 20 },
  { id: 'fen_td', n: 'fentanilo transdérmico', u: 'mcg/h', f: 2.4 },
  { id: 'fen_iv', n: 'fentanilo IV/SC', u: 'mcg/día', f: 0.3 },
  { id: 'tra', n: 'tramadol', u: 'mg/día', f: 0.2 },
  { id: 'tap', n: 'tapentadol VO', u: 'mg/día', f: 0.4 },
  { id: 'cod', n: 'codeína VO', u: 'mg/día', f: 0.15 },
  { id: 'hc', n: 'hidrocodona VO', u: 'mg/día', f: 1 },
  { id: 'met', n: 'metadona VO', u: 'mg/día', f: 4.7, noTarget: true },
];

export const opioidById = (id: string): Opioid => OPIOIDS.find((o) => o.id === id) || OPIOIDS[0];
export const opioidDefault = (): OpioidValue => ({ rows: [{ o: 'mor_iv', d: '', f: '3' }], tgt: '', red: '30', res: '10' });

export const REDUCTIONS = [0, 25, 30, 40, 50];
export const RESCUES = [0, 10, 15];

export function opioidCalc(v?: OpioidValue) {
  v = v || opioidDefault();
  const rows = (v.rows || []).map((r) => {
    const o = opioidById(r.o), d = num(r.d), f = num(r.f);
    return { o, d, f, mme: d * f };
  });
  const total = rows.reduce((a, r) => a + r.mme, 0);
  let rot: null | {
    o: Opioid; red: number; res: number; dose: number; ft: number;
    rescue: { n: string; x: number; u: string };
  } = null;
  if (v.tgt && total > 0) {
    const o = opioidById(v.tgt);
    const red = num(v.red) / 100, res = num(v.res) / 100;
    const ft = num(v.tf != null && v.tf !== '' ? v.tf : o.f) || o.f;
    const base = total * (1 - red), dose = base / ft;
    rot = {
      o, red: num(v.red), res: num(v.res), dose, ft,
      rescue: o.id === 'fen_td'
        ? { n: 'morfina VO', x: base * res, u: 'mg' }
        : { n: o.n, x: dose * res, u: o.u.replace('/día', '').replace('/h', '') },
    };
  }
  return { rows, total, rot };
}

export function opioidText(v?: OpioidValue): string {
  const c = opioidCalc(v), used = c.rows.filter((r) => r.d > 0);
  if (!used.length) return '';
  let s = 'Recibe ' + used.map((r) => `${r.o.n} ${fmt(r.d)} ${r.o.u} (factor ${fmt(r.f)}: ${fmt(r.mme)} mg de EMM)`).join('; ') + '. ';
  s += `Dosis total equivalente a morfina oral (EMM): ${fmt(c.total)} mg/24 h.`;
  if (used.some((r) => r.o.id === 'met')) s += ' La conversión de metadona no es lineal; el valor es solo orientativo.';
  if (c.rot) {
    const r = c.rot;
    s += ` Se propone rotación a ${r.o.n} con reducción del ${fmt(r.red)}% por tolerancia cruzada incompleta: ${fmt(r.dose)} ${r.o.u}` +
      (r.o.id === 'fen_td' ? ', ajustando al parche disponible' : '') + '.';
    if (r.res) s += ` Rescate: ${r.rescue.n} ${fmt(r.rescue.x)} ${r.rescue.u} (${fmt(r.res)}% de la dosis diaria).`;
  }
  return s;
}
