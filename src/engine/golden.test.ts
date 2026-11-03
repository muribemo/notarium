/**
 * Compara el texto que genera el motor nuevo con el del prototipo original (v40)
 * en las 96 plantillas, con dos escenarios: todo vacío y todo lleno.
 * Los textos de referencia se generan con `npm run extract`.
 */
import { describe, expect, it } from 'vitest';
import { BUILTIN_TEMPLATES } from '../content/builtin';
import golden from './__fixtures__/golden.json';
import { optLabel, toText } from './text';
import type { NoteState, Template, Value } from './types';

const h = (s: string) => { let x = 0; for (const c of s) x = (x * 31 + c.codePointAt(0)!) >>> 0; return x; };

function scenario(t: Template, kind: 'empty' | 'full'): Record<string, Value> {
  const v: Record<string, Value> = {};
  for (const [k, d] of Object.entries(t.vars)) {
    if (kind === 'empty') {
      if (d.def != null) v[k] = d.def;
      if (d.kind === 'multi') v[k] = [];
      continue;
    }
    const o = d.options || [];
    const hs = () => h(o.map((x) => optLabel(x.v)).join('|'));
    if (d.kind === 'text') v[k] = d.inOpt ? 'YY' : 'XX';
    else if (d.kind === 'choice') v[k] = o[hs() % o.length].v;
    else if (d.kind === 'multi') {
      const idx = o.map((_, i) => i).filter((i) => !o[i].ex);
      if (!idx.length) v[k] = [o[0].v];
      else { const s = hs(); v[k] = [...new Set([idx[s % idx.length], idx[(s + 1) % idx.length]])].sort((a, b) => a - b).map((i) => o[i].v); }
    } else if (d.kind === 'quest') v[k] = { a: Object.fromEntries(questAnswers(d.qid!)), open: true };
    else if (d.kind === 'opioid') v[k] = { rows: [{ o: 'mor_vo', d: '60', f: '1' }, { o: 'fen_td', d: '25', f: '2.4' }], tgt: 'oxi_vo', red: '30', res: '10' };
    else if (d.kind === 'la') v[k] = { peso: '70', rows: [{ a: 'ropi', c: '0.5', v: '20', e: false, m: '3' }, { a: 'lido', c: '2', v: '5', e: true, m: '7' }] };
  }
  return v;
}

import { QUESTS } from '../clinical/questionnaires';
function questAnswers(qid: string): [number, number][] {
  return QUESTS[qid].items.map((it, i) => [i, it.t === 'yn' ? 1 : it.t === 'num' ? Math.min(3, it.max) : it.o[it.o.length > 1 ? 1 : 0].v]);
}

/**
 * Cambio deliberado frente al prototipo: los grupos sin nombre ya no muestran sus opciones cortadas
 * a 48 caracteres ("…/ vómito / estr]") sino una etiqueta legible ("…"). Se traduce la referencia.
 */
function withNewAutoLabels(t: Template, expected: string): string {
  const norm = (x: string) => x.replace(/⟦\w*⟧?/g, '⟦⟧');
  let out = expected;
  for (const d of Object.values(t.vars)) {
    if (!d.auto || !d.options) continue;
    const full = norm(d.options.map((o) => o.v).join(' / '));
    out = out.replace(/\[([^[\]\n]+)\]/g, (m, c: string) => (full.startsWith(norm(c).replace(/⟦⟧$/, '')) && c.length >= Math.min(full.length, 30) ? '[' + d.label + ']' : m));
  }
  return out;
}

const G = golden as Record<string, { empty: string; full: string }>;

describe('equivalencia con el prototipo v40', () => {
  it('incluye todas las plantillas del prototipo', () => {
    const ids = new Set(BUILTIN_TEMPLATES.map((t) => t.id));
    expect(Object.keys(G).filter((id) => !ids.has(id))).toEqual([]);
  });
  for (const t of BUILTIN_TEMPLATES.filter((x) => x.id in G)) {
    for (const kind of ['empty', 'full'] as const) {
      it(`${t.id} (${kind})`, () => {
        const n: NoteState = { values: scenario(t, kind), custom: {}, lit: {}, drop: {}, items: {} };
        const text = toText(t, { note: () => n, vis: () => undefined, inserted: () => undefined });
        expect(text).toBe(kind === 'empty' ? withNewAutoLabels(t, G[t.id][kind]) : G[t.id][kind]);
      });
    }
  }
});
