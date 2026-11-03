/**
 * Persistencia. Hoy: el navegador (localStorage). La interfaz permite conectar
 * más adelante un servidor con cuentas de usuario sin tocar el resto de la app.
 */
import type { Value, Visibility } from '../engine/types';
import type { CustomRecord } from './catalog';

export interface Settings {
  fav: string[];
  recent: string[];
  /** Elecciones recordadas (@) por plantilla. */
  sticky: Record<string, Record<string, Value>>;
  /** Secciones y párrafos ocultos por plantilla. */
  vis: Record<string, Visibility>;
  /** Ocultar las opciones descartadas una vez elegida una. */
  hide?: boolean;
  mirror?: boolean;
  compact?: boolean;
  theme?: 'light' | 'dark' | null;
  ptab?: 'notas' | 'blk';
  collapsed?: Record<string, boolean>;
  /** Veces que se ha insertado cada bloque, para ordenarlos. */
  useBlk?: Record<string, number>;
  tourDone?: boolean;
  /** Profesional que firma las notas. */
  profile?: { name?: string; reg?: string; specialty?: string };
  /** Fecha (ms) del último respaldo exportado. */
  lastBackup?: number;
  /** Atenuar lo completo y mostrar solo lo pendiente. */
  onlyPending?: boolean;
  [k: string]: unknown;
}

export const blankSettings = (): Settings => ({ fav: [], recent: [], sticky: {}, vis: {} });

export interface Persisted {
  settings: Settings;
  custom: Record<string, CustomRecord>;
}

export interface StorageBackend {
  readonly label: string;
  load(): Persisted;
  saveSettings(s: Settings): void;
  saveCustom(c: Record<string, CustomRecord>): void;
}

/** Mismas claves que el prototipo, por si alguna vez comparten origen. */
const LS = 'notarium:v2:';

function lsGet<T>(k: string, d: T): T {
  try {
    const v = localStorage.getItem(LS + k);
    return v ? (JSON.parse(v) as T) : d;
  } catch {
    return d;
  }
}
function lsSet(k: string, v: unknown): boolean {
  try {
    localStorage.setItem(LS + k, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}

export const localBackend: StorageBackend = {
  label: 'Guardado en este navegador.',
  load() {
    return {
      settings: Object.assign(blankSettings(), lsGet<Partial<Settings>>('settings', {})),
      custom: lsGet<{ items?: Record<string, CustomRecord> }>('custom', { items: {} }).items || {},
    };
  },
  saveSettings(s) { lsSet('settings', s); },
  saveCustom(c) { lsSet('custom', { items: c }); },
};

/* ---------------- respaldo ---------------- */

export interface Backup {
  app: 'notarium';
  format: 1;
  version: string;
  exported: string;
  settings: Settings;
  custom: Record<string, CustomRecord>;
}

export function makeBackup(p: Persisted, version: string): Backup {
  return {
    app: 'notarium', format: 1, version, exported: new Date().toISOString(),
    settings: structuredClone(p.settings), custom: structuredClone(p.custom),
  };
}

export function isBackup(o: unknown): o is Backup {
  const b = o as Backup;
  return !!b && b.app === 'notarium' && !!b.settings && !!b.custom;
}

/** Migra las "frases" del formato antiguo a bloques de texto. */
export function migrateSnips(p: Persisted): boolean {
  const L = (p.settings.snips as { id: string; name?: string; text?: string; cat?: string }[] | undefined) || [];
  if (!L.length) return false;
  for (const x of L) {
    const id = 's_' + x.id;
    if (p.custom[id] || !(x.text || '').trim()) continue;
    p.custom[id] = {
      id, name: (x.name || x.text!.slice(0, 40)).trim(), short: '', group: (x.cat || '').trim() || 'Mis bloques',
      lang: 'es', source: x.text, use: 'bloque', insMode: 'texto', updated: Date.now(),
    };
  }
  p.settings.snipsLegacy = [...((p.settings.snipsLegacy as unknown[]) || []), ...L];
  p.settings.snips = [];
  return true;
}

/** Combina un respaldo con lo actual: agrega lo que falta y actualiza lo más reciente. */
export function mergeBackup(cur: Persisted, b: Backup): Persisted {
  const out = structuredClone(cur);
  for (const [id, c] of Object.entries(b.custom)) {
    const have = out.custom[id];
    if (!have || (c.updated || 0) > (have.updated || 0)) out.custom[id] = c;
  }
  const s = out.settings, bs = b.settings;
  s.fav = [...new Set([...(s.fav || []), ...(bs.fav || [])])];
  const snips = (s.snips as { id: string }[] | undefined) || [];
  const have = new Set(snips.map((x) => x.id));
  for (const x of (bs.snips as { id: string }[] | undefined) || []) if (!have.has(x.id)) snips.push(x);
  s.snips = snips;
  for (const k of ['sticky', 'vis'] as const) {
    if (!s[k]) (s as Record<string, unknown>)[k] = {};
    const dst = s[k] as Record<string, unknown>;
    for (const [id, v] of Object.entries(bs[k] || {})) if (!(id in dst)) dst[id] = v;
  }
  migrateSnips(out);
  return out;
}

export function replaceWithBackup(b: Backup): Persisted {
  const out: Persisted = { settings: Object.assign(blankSettings(), structuredClone(b.settings)), custom: structuredClone(b.custom) };
  migrateSnips(out);
  return out;
}
