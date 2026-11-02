/** Catálogo: plantillas incluidas + versiones propias + plantillas propias + notas compuestas. */
import { BUILTIN_COMBOS, BUILTIN_TEMPLATES, GROUP_ORDER, type ComboDef } from '../content/builtin';
import { parseTemplate } from '../engine/parse';
import type { InsertMode, Lang, Template, Use } from '../engine/types';

/**
 * Registro guardado de una plantilla propia, una versión propia de una incluida (override)
 * o una nota compuesta (kind: 'combo'). Mismo formato que el respaldo del prototipo.
 */
export interface CustomRecord {
  id: string;
  name: string;
  short?: string;
  group?: string;
  lang?: Lang;
  source?: string;
  use?: Use;
  insMode?: InsertMode;
  title?: string;
  normal?: boolean;
  updated: number;
  override?: boolean;
  kind?: 'combo';
  base?: string;
  blocks?: { sid: string; title?: string; tpl: string }[];
}

export type CatalogTemplate = Template & {
  combo?: ComboDef;
  overridden?: boolean;
  custom?: boolean;
};

export interface Catalog {
  list: CatalogTemplate[];
  byId: Map<string, CatalogTemplate>;
  groups: string[];
}

const builtinById = new Map(BUILTIN_TEMPLATES.map((t) => [t.id, t]));
export const isBuiltinId = (id: string) => builtinById.has(id);
export const builtinTemplate = (id: string) => builtinById.get(id);

const parsedCache = new Map<string, Template>();
function parsedOf(c: CustomRecord): Template {
  const key = c.id + '|' + c.updated + '|' + (c.source || '').length;
  let p = parsedCache.get(key);
  if (!p) {
    p = parseTemplate({ id: c.id, name: c.name, short: c.short, group: c.group, lang: c.lang, use: c.use, insert: c.insMode, title: c.title, normal: c.normal }, c.source || '');
    parsedCache.set(key, p);
  }
  return p;
}

export function comboFromRecord(c: CustomRecord): ComboDef {
  return {
    id: c.id, name: c.name, short: c.short, base: c.base || 'libre', updated: c.updated,
    blocks: (c.blocks || []).map((b) => ({ section: b.sid, title: b.title, template: b.tpl })),
  };
}
export function comboToRecord(c: ComboDef): CustomRecord {
  return {
    id: c.id, kind: 'combo', name: c.name, short: c.short || '', base: c.base, updated: c.updated || Date.now(),
    blocks: c.blocks.map((b) => ({ sid: b.section, title: b.title, tpl: b.template })),
  };
}

export function buildCatalog(custom: Record<string, CustomRecord>): Catalog {
  const base: CatalogTemplate[] = BUILTIN_TEMPLATES.map((t) => {
    const o = custom[t.id];
    if (o && o.override) {
      const p = parsedOf(o);
      return {
        ...p, group: t.group, builtin: true, overridden: true,
        normal: t.normal || !!o.normal, use: o.use || t.use, insMode: o.insMode || t.insMode,
        title: (o.title || '').trim() || t.title,
      };
    }
    return t;
  });
  for (const c of Object.values(custom)) {
    if (c.override || c.kind === 'combo') continue;
    base.push({ ...parsedOf(c), custom: true });
  }
  const combos: ComboDef[] = [
    ...BUILTIN_COMBOS.filter((b) => !custom[b.id]),
    ...Object.values(custom).filter((c) => c.kind === 'combo').map(comboFromRecord),
  ];
  const list: CatalogTemplate[] = [...base];
  for (const c of combos) {
    const b = base.find((x) => x.id === c.base);
    if (!b) continue;
    list.push({ ...b, id: c.id, name: c.name || b.name, short: c.short || '', combo: c, use: 'nota', baseId: b.id, builtin: false, overridden: false, custom: false });
  }
  const seen = new Set<string>();
  const groups = [...GROUP_ORDER, ...list.map((t) => t.group)].filter((g) => {
    if (seen.has(g) || !list.some((t) => t.group === g)) return false;
    seen.add(g);
    return true;
  });
  return { list, byId: new Map(list.map((t) => [t.id, t])), groups };
}

export const isNoteTpl = (t: CatalogTemplate) => t.use !== 'bloque';
export const isBlockTpl = (t: CatalogTemplate) => t.use !== 'nota' && !t.combo && t.id !== 'libre';
