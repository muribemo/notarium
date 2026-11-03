/** Las versiones en español de los procedimientos: completas, en español y con códigos CIE-10 OMS. */
import { describe, expect, it } from 'vitest';
import { freshNote, toText } from '../engine/text';
import { BUILTIN_TEMPLATES } from './builtin';

const es = BUILTIN_TEMPLATES.filter((t) => t.id.endsWith('_es'));
const byId = new Map(BUILTIN_TEMPLATES.map((t) => [t.id, t]));

describe('procedimientos en español', () => {
  it('hay una versión en español por cada procedimiento en inglés', () => {
    const en = BUILTIN_TEMPLATES.filter((t) => t.group === 'Dolor intervencionista (inglés)');
    expect(en.length).toBe(20);
    expect(en.filter((t) => !byId.has(t.id + '_es')).map((t) => t.id)).toEqual([]);
  });
  for (const t of es) {
    it(`${t.id}: completa y en español`, () => {
      const en = byId.get(t.id.replace(/_es$/, ''))!;
      expect(t.lang).toBe('es');
      expect(t.group).toBe('Dolor intervencionista');
      // mismas opciones de técnica recordadas (@) y no menos grupos de opciones que la original
      expect(t.sticky.length).toBeGreaterThanOrEqual(en.sticky.filter((k) => en.vars[k].kind !== 'text').length);
      const choices = (x: typeof t) => Object.values(x.vars).filter((d) => (d.kind === 'choice' || d.kind === 'multi') && !/^cpt$/i.test(d.label)).length;
      expect(choices(t)).toBeGreaterThanOrEqual(choices(en) - 1);
      // eligiendo la primera opción de todo, el texto no tiene corchetes, inglés ni códigos CM de 5 caracteres
      const n = freshNote(t);
      for (const [k, d] of Object.entries(t.vars)) if (d.options) n.values[k] = d.kind === 'multi' ? [d.options[0].v] : d.options[0].v;
      const txt = toText(t, { note: () => n, vis: () => undefined, inserted: () => undefined });
      expect(txt).not.toMatch(/\[/);
      expect(txt).not.toMatch(/\b(the|was|with|patient|injection|needle)\b/i);
      expect(txt).not.toMatch(/\b[A-Z]\d\d\.\d{2,}/);
      expect(txt).toMatch(/Dr\. Mateo Uribe Moreno, Anestesiología y Medicina del Dolor\. \d\d\/\d\d\/\d{4}\./);
    });
  }
});
