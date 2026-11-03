/** Modelo de datos de plantillas y notas. */

export type Lang = 'es' | 'en';
export type VarKind = 'text' | 'choice' | 'multi' | 'opioid' | 'la' | 'quest';
/** nota: aparece en la lista de notas; bloque: solo se inserta; ambos: las dos cosas. */
export type Use = 'nota' | 'bloque' | 'ambos';
/** seccion: se inserta con su subtítulo; texto: se inserta como texto corrido. */
export type InsertMode = 'seccion' | 'texto';

export interface Option {
  v: string;
  warn?: boolean;
  hint?: string;
  /** En selección múltiple, opción excluyente (p. ej. "sin hallazgos"). */
  ex?: boolean;
}

export interface VarDef {
  label: string;
  kind: VarKind;
  options?: Option[];
  def?: string;
  today?: boolean;
  /** Campo que vive dentro de una opción y solo aparece si esa opción está elegida. */
  inOpt?: boolean;
  /** Selección múltiple que sale como lista con guiones. */
  list?: boolean;
  /** Identificador del cuestionario (kind === 'quest'). */
  qid?: string;
  hint?: string;
}

export interface Section {
  id: string;
  title: string;
  on: boolean;
  /** Párrafos; los campos aparecen como {{clave}} o {{clave|cap}}. */
  blocks: string[];
}

export interface TemplateMeta {
  id: string;
  name: string;
  short?: string;
  group?: string;
  lang?: Lang;
  use?: Use;
  insert?: InsertMode;
  title?: string;
  normal?: boolean;
  /** Posición dentro de su grupo en el panel. */
  order?: number;
}

export interface Template {
  id: string;
  name: string;
  short: string;
  group: string;
  lang: Lang;
  use: Use;
  insMode: InsertMode;
  title: string;
  /** Muestra el botón "Todo normal" (elige la primera opción de cada grupo). */
  normal: boolean;
  sticky: string[];
  vars: Record<string, VarDef>;
  sections: Section[];
  textOnly: boolean;
  /** Fuente en el mini-lenguaje, para editar. */
  source: string;
  builtin?: boolean;
  /** Bloque insertado dentro de otra nota. */
  virtual?: boolean;
  baseId?: string;
}

export interface OpioidRow { o: string; d: string; f: string }
export interface OpioidValue { rows: OpioidRow[]; tgt: string; red: string; res: string; tf?: string }
export interface LARow { a: string; c: string; v: string; e: boolean; m: string }
export interface LAValue { peso: string; rows: LARow[] }
export interface QuestValue { a: Record<number, number>; open?: boolean }

export type Value = string | string[] | OpioidValue | LAValue | QuestValue | undefined;

export type Item =
  | { k: 'x'; id: string; v: string }
  | { k: 'b'; uid: string; base: string; ttl?: boolean; min?: boolean };

export interface NoteState {
  values: Record<string, Value>;
  /** Opciones escritas a mano para esta nota, por campo. */
  custom: Record<string, string[]>;
  /** Texto literal editado por párrafo ("sección:índice"). */
  lit: Record<string, string[]>;
  /** Campos quitados de un párrafo: índice del token. */
  drop: Record<string, Record<number, true>>;
  /** Bloques y textos insertados por sección. */
  items: Record<string, Item[]>;
}

export interface Visibility {
  sec: Record<string, boolean>;
  par: Record<string, boolean>;
}
