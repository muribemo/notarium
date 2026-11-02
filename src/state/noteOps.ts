/** Operaciones sobre el estado de una nota (puras; mutan el objeto recibido). */
import { isChoice, isFilled, parHidden, parts, secOn } from '../engine/text';
import type { NoteState, Template, Visibility } from '../engine/types';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const isExclusive = (t: Template, k: string, v: string) => !!t.vars[k].options?.find((o) => o.v === v)?.ex;

/** Tocar una opción: en única la elige o la quita; en múltiple respeta las excluyentes. */
export function toggleOption(t: Template, n: NoteState, k: string, v: string): boolean {
  const d = t.vars[k];
  if (d.kind === 'multi') {
    let arr = [...((n.values[k] as string[]) || [])];
    const i = arr.indexOf(v);
    if (i >= 0) arr.splice(i, 1);
    else {
      arr = isExclusive(t, k, v) ? [v] : arr.filter((x) => !isExclusive(t, k, x));
      arr.push(v);
      arr = [...new Set(arr)];
    }
    const opts = d.options!.map((o) => o.v);
    n.values[k] = opts.filter((x) => arr.includes(x)).concat(arr.filter((x) => !opts.includes(x)));
    return (n.values[k] as string[]).includes(v);
  }
  n.values[k] = n.values[k] === v ? undefined : v;
  return n.values[k] === v;
}

export function addCustomOption(t: Template, n: NoteState, k: string, v: string) {
  (n.custom[k] = n.custom[k] || []).push(v);
  if (t.vars[k].kind === 'multi') n.values[k] = [...((n.values[k] as string[]) || []), v];
  else n.values[k] = v;
}

/** Claves de los campos visibles (secciones encendidas, párrafos visibles, sin quitar). */
export function activeKeys(t: Template, n: NoteState, vis: Visibility | undefined): string[] {
  const ks = new Set<string>();
  for (const s of t.sections) {
    if (!secOn(vis, s)) continue;
    s.blocks.forEach((b, i) => {
      if (parHidden(vis, s.id, i)) return;
      const dr = n.drop[s.id + ':' + i] || {};
      parts(b).toks.forEach((x, j) => { if (!dr[j]) ks.add(x.k); });
    });
  }
  return [...ks];
}

/** Opciones sin elegir (no cuenta campos de texto, calculadoras ni cuestionarios). */
export function pendingOne(t: Template, n: NoteState, vis: Visibility | undefined): number {
  return activeKeys(t, n, vis).filter((k) => isChoice(t.vars[k]) && !isFilled(t.vars[k], n.values[k])).length;
}
export function choiceCount(t: Template, n: NoteState, vis: Visibility | undefined): number {
  return activeKeys(t, n, vis).filter((k) => isChoice(t.vars[k])).length;
}
export function emptyOne(t: Template, n: NoteState, vis: Visibility | undefined): number {
  return activeKeys(t, n, vis).filter((k) => t.vars[k]?.kind === 'text' && !isFilled(t.vars[k], n.values[k])).length;
}

/** "Todo normal": elige la primera opción en lo que esté pendiente. Devuelve cuántas marcó. */
export function allNormal(t: Template, n: NoteState, vis: Visibility | undefined): number {
  let c = 0;
  for (const k of activeKeys(t, n, vis)) {
    const d = t.vars[k];
    if (!d || !d.options || !isChoice(d) || isFilled(d, n.values[k])) continue;
    n.values[k] = d.kind === 'multi' ? [d.options[0].v] : d.options[0].v;
    c++;
  }
  return c;
}

/** Valores a recordar (@) para la próxima nota. */
export function stickyValues(t: Template, n: NoteState) {
  const o: Record<string, NoteState['values'][string]> = {};
  for (const k of t.sticky) {
    const x = n.values[k];
    if (x != null && x !== '' && !(Array.isArray(x) && !x.length)) o[k] = x;
  }
  return o;
}
