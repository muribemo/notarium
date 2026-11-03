import { describe, expect, it } from 'vitest';
import { opioidText } from '../clinical/opioids';
import { laText } from '../clinical/localAnesthetics';
import { allNormal, toggleOption } from '../state/noteOps';
import { mergeBackup, type Backup } from '../state/storage';
import { parseTemplate, parseTemplateFile, serializeTemplateFile } from './parse';
import { freshNote, toText } from './text';
import type { NoteState, Template } from './types';

const tpl = (src: string, lang: 'es' | 'en' = 'es') => parseTemplate({ id: 't', name: 'T', lang }, src);
const text = (t: Template, n: NoteState) => toText(t, { note: () => n, vis: () => undefined, inserted: () => undefined });

describe('mini-lenguaje', () => {
  it('lee pistas de opción y de campo', () => {
    const t = tpl('[aguja: roma (? menos riesgo (intravascular)) / Quincke / ?? Elige según el caso]');
    const d = t.vars.aguja;
    expect(d.options).toEqual([{ v: 'roma', hint: 'menos riesgo (intravascular)' }, { v: 'Quincke' }]);
    expect(d.hint).toBe('Elige según el caso');
  });

  it('respeta ^ y ~ para la mayúscula', () => {
    const t = tpl('**SEDATION:** [^sed: midazolam / fentanyl]. Then. [~x: done / pending].');
    const n = freshNote(t);
    n.values.sed = 'midazolam';
    n.values.x = 'done';
    expect(text(t, n)).toBe('SEDATION: Midazolam. Then. done.');
  });

  it('quita la unidad de un campo vacío y muestra [etiqueta] en opciones sin elegir', () => {
    const t = tpl('Peso {peso} kg; lado [lado: derecho / izquierdo].');
    expect(text(t, freshNote(t))).toBe('Peso; lado [lado].');
  });

  it('campo dentro de una opción', () => {
    const t = tpl('Bolo: [bolo: sin bolo / administrar {dosis} mg].');
    const n = freshNote(t);
    n.values.bolo = 'administrar ⟦dosis⟧ mg';
    expect(text(t, n)).toBe('Bolo: administrar.');
    n.values.dosis = '2';
    expect(text(t, n)).toBe('Bolo: administrar 2 mg.');
  });

  it('lista con guiones', () => {
    const t = tpl('Órdenes: [- o: no reanimación / no intubación]');
    const n = freshNote(t);
    n.values.o = ['no reanimación', 'no intubación'];
    expect(text(t, n)).toBe('Órdenes:\n- No reanimación\n- No intubación');
  });

  it('ida y vuelta del archivo .md', () => {
    const file = serializeTemplateFile({ id: 'x', name: 'Prueba', group: 'G', lang: 'es', use: 'ambos', normal: true, order: 3 }, '## S\nHola {nombre}.\n');
    const { meta, source } = parseTemplateFile(file);
    expect(meta).toEqual({ id: 'x', name: 'Prueba', group: 'G', lang: 'es', use: 'ambos', normal: true, order: 3 });
    expect(source).toBe('## S\nHola {nombre}.\n');
  });
});

describe('selección', () => {
  const t = tpl('Hallazgos: [* h: 0 sin hallazgos / dolor / edema].');
  it('la opción excluyente quita las demás y viceversa', () => {
    const n = freshNote(t);
    toggleOption(t, n, 'h', 'edema');
    toggleOption(t, n, 'h', 'dolor');
    expect(n.values.h).toEqual(['dolor', 'edema']);
    toggleOption(t, n, 'h', 'sin hallazgos');
    expect(n.values.h).toEqual(['sin hallazgos']);
    toggleOption(t, n, 'h', 'dolor');
    expect(n.values.h).toEqual(['dolor']);
  });
  it('Todo normal elige la primera opción solo en lo pendiente', () => {
    const t2 = tpl('[a: normal / anormal] [b: sí / no] {texto}');
    const n = freshNote(t2);
    n.values.b = 'no';
    expect(allNormal(t2, n, undefined)).toBe(1);
    expect(n.values).toMatchObject({ a: 'normal', b: 'no' });
  });
});

describe('calculadoras', () => {
  it('equivalencia y rotación de opioides', () => {
    const s = opioidText({ rows: [{ o: 'mor_iv', d: '30', f: '3' }], tgt: 'oxi_vo', red: '30', res: '10' });
    expect(s).toContain('90 mg/24 h');
    expect(s).toContain('oxicodona VO con reducción del 30% por tolerancia cruzada incompleta: 42 mg/día');
    expect(s).toContain('Rescate: oxicodona VO 4,2 mg');
  });
  it('anestésico local: porcentaje de la dosis máxima', () => {
    const s = laText({ peso: '70', rows: [{ a: 'ropi', c: '0.5', v: '30', e: false, m: '3' }] });
    expect(s).toContain('ropivacaína 0,5% 30 mL (150 mg, 2,14 mg/kg)');
    expect(s).toContain('al 71% de la dosis máxima');
  });
});

describe('respaldo', () => {
  it('combinar conserva lo más reciente y migra frases antiguas', () => {
    const cur = { settings: { fav: ['a'], recent: [], sticky: {}, vis: {} }, custom: { x: { id: 'x', name: 'Viejo', updated: 1 } } };
    const bk: Backup = {
      app: 'notarium', format: 1, version: 'v40', exported: '',
      settings: { fav: ['b'], recent: [], sticky: {}, vis: {}, snips: [{ id: '1', name: 'Frase', text: 'Hola' }] },
      custom: { x: { id: 'x', name: 'Nuevo', updated: 2 } },
    };
    const out = mergeBackup(cur, bk);
    expect(out.custom.x.name).toBe('Nuevo');
    expect(out.settings.fav).toEqual(['a', 'b']);
    expect(out.custom.s_1).toMatchObject({ name: 'Frase', source: 'Hola', use: 'bloque' });
  });
});

describe('copiar sin pendientes', () => {
  it('quita frases sin datos y conserva las que tienen datos llenados', () => {
    const t = tpl('Historia de {duración} de dolor, refractario a [manejo: fisioterapia / AINES]. Lado [lado: derecho / izquierdo]. Firma {médico=Dr. X}.');
    const n = freshNote(t);
    n.values['duracion'] = '6 meses';
    expect(toText(t, { note: () => n, vis: () => undefined, inserted: () => undefined }, { omitPending: true }))
      .toBe('Historia de 6 meses de dolor, refractario a. Firma Dr. X.');
  });
});
