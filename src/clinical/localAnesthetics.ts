/**
 * Calculadora de dosis máxima de anestésico local por peso.
 * Las fracciones de la dosis máxima de varios agentes se suman.
 */
import type { LAValue } from '../engine/types';
import { fmt, num } from './format';

/** m: dosis máxima mg/kg sin epinefrina; mE: con epinefrina. */
export interface LocalAnesthetic { id: string; n: string; m: number; mE: number }

export const LOCAL_ANESTHETICS: LocalAnesthetic[] = [
  { id: 'lido', n: 'lidocaína', m: 4.5, mE: 7 },
  { id: 'mepi', n: 'mepivacaína', m: 4.5, mE: 7 },
  { id: 'bupi', n: 'bupivacaína', m: 2.5, mE: 3 },
  { id: 'levo', n: 'levobupivacaína', m: 2.5, mE: 3 },
  { id: 'ropi', n: 'ropivacaína', m: 3, mE: 3 },
];

export const laById = (id: string) => LOCAL_ANESTHETICS.find((x) => x.id === id) || LOCAL_ANESTHETICS[0];
export const laDefault = (): LAValue => ({ peso: '', rows: [{ a: 'ropi', c: '0.5', v: '', e: false, m: '3' }] });

export function laCalc(v?: LAValue) {
  v = v || laDefault();
  const kg = num(v.peso);
  const rows = (v.rows || []).map((r) => {
    const a = laById(r.a);
    // concentración % × 10 = mg/mL
    const mg = num(r.c) * 10 * num(r.v);
    const mx = num(r.m) || (r.e ? a.mE : a.m);
    const lim = kg * mx;
    return { a, c: num(r.c), vol: num(r.v), e: !!r.e, mg, mgkg: kg ? mg / kg : 0, frac: lim ? mg / lim : 0, mx };
  });
  return { kg, rows, tot: rows.reduce((s, r) => s + r.frac, 0) };
}

export type LALevel = '' | 'warn' | 'bad';
export const laLevel = (tot: number): LALevel => (tot >= 1 ? 'bad' : tot >= 0.8 ? 'warn' : '');

export function laText(v?: LAValue): string {
  const c = laCalc(v), u = c.rows.filter((r) => r.mg > 0);
  if (!u.length) return '';
  let s = 'Anestésicos locales: ' + u.map((r) =>
    `${r.a.n} ${fmt(r.c)}%${r.e ? ' con epinefrina' : ''} ${fmt(r.vol)} mL (${fmt(r.mg)} mg${c.kg ? `, ${(Math.round(r.mgkg * 100) / 100).toLocaleString('es-CO')} mg/kg` : ''})`,
  ).join('; ') + '.';
  if (c.kg) {
    s += ` Dosis total equivalente al ${Math.round(c.tot * 100)}% de la dosis máxima recomendada para ${fmt(c.kg)} kg` +
      (c.tot >= 1 ? '; supera la dosis máxima' : c.tot >= 0.8 ? '; cercana a la dosis máxima' : '') + '.';
  }
  return s;
}
