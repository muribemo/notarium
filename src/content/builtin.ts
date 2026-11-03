/** Plantillas y notas compuestas incluidas en la aplicación (carpeta /content). */
import { parseTemplate, parseTemplateFile } from '../engine/parse';
import type { Template } from '../engine/types';
import combosJson from '../../content/combos.json';

const files = import.meta.glob('../../content/templates/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Orden de los grupos en el panel. */
export const GROUP_ORDER = [
  'Dolor intervencionista',
  'Anestesia',
  'Ronda dolor y paliativos',
  'Consulta e historia clínica',
  'Examen físico por región',
  'Cuestionarios',
];

export interface ComboDef {
  id: string;
  name: string;
  short?: string;
  /** Plantilla base de la nota compuesta. */
  base: string;
  blocks: { section: string; title?: string; template: string }[];
  updated?: number;
  builtin?: boolean;
}

function load(): Template[] {
  const out: Template[] = [];
  const order = new Map<string, number>();
  for (const [path, text] of Object.entries(files)) {
    try {
      const { meta, source } = parseTemplateFile(text);
      out.push({ ...parseTemplate(meta, source), builtin: true });
      order.set(meta.id, meta.order ?? 999);
    } catch (e) {
      console.error('Plantilla inválida', path, e);
    }
  }
  const gi = (g: string) => { const i = GROUP_ORDER.indexOf(g); return i < 0 ? 99 : i; };
  return out.sort((a, b) => gi(a.group) - gi(b.group) || order.get(a.id)! - order.get(b.id)! || a.name.localeCompare(b.name, 'es'));
}

export const BUILTIN_TEMPLATES: Template[] = load();
export const BUILTIN_COMBOS: ComboDef[] = (combosJson as ComboDef[]).map((c) => ({ ...c, builtin: true, updated: 0 }));

/** Nota libre: hoja en blanco para armar con bloques y texto. */
export const FREE_NOTE_ID = 'libre';
