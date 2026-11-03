/** Generación del texto final de la nota a partir de la plantilla y las selecciones. */
import { cap, joinList, num } from '../clinical/format';
import { laDefault, laText } from '../clinical/localAnesthetics';
import { opioidDefault, opioidText } from '../clinical/opioids';
import { questText } from '../clinical/questionnaires';
import type { LAValue, NoteState, OpioidValue, QuestValue, Section, Template, Value, VarDef, Visibility } from './types';

export const TOK = /\{\{(\w+)(\|cap)?\}\}/g;
export const OPF = /⟦(\w+)⟧/g;
/** Unidad que sigue a un campo vacío: no debe quedar suelta en la nota. */
export const UNIT_RE = /^ ?(mg\/h|mcg\/h|mg\/kg|mL\/h|mg|mcg|mL|kg\/m²|kg|cm|mmHg|lpm|rpm|°C|%|\/\d+)(?=[\s.,;:)]|$)/;
/** Párrafo que es solo un subtítulo en negrita. */
export const HEADING_RE = /^\*\*[^*]+\*\*( \{\{\w+(\|cap)?\}\})?$/;

export function todayStr(lang: 'es' | 'en', d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return lang === 'en'
    ? `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()}`
    : `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function timeStr(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Datos del profesional que firman las notas. */
export interface Profile { name?: string; reg?: string; specialty?: string }
/** Campos de firma que toman el nombre del perfil. */
export const SIGNER_RE = /^(médico|medico|physician|anestesiólogo|anestesiologo|provider)$/i;
export function signerValue(p: Profile | undefined, lang: 'es' | 'en'): string | undefined {
  const name = p?.name?.trim();
  if (!name) return undefined;
  const reg = p?.reg?.trim();
  return reg ? `${name} (${lang === 'en' ? 'Lic.' : 'RM'} ${reg})` : name;
}

/** Marca interna de una opción sin elegir, para poder omitir su frase al copiar. */
const PEND = '\u0001';

export function isFilled(d: VarDef, val: Value): boolean {
  switch (d.kind) {
    case 'la': return !!(val && ((val as LAValue).rows || []).some((r) => num(r.v) > 0));
    case 'quest': return !!(val && (val as QuestValue).a && Object.keys((val as QuestValue).a).length);
    case 'opioid': return !!(val && ((val as OpioidValue).rows || []).some((r) => num(r.d) > 0));
    case 'multi': return Array.isArray(val) && val.length > 0;
    default: return val != null && String(val).trim() !== '';
  }
}

/** Selecciones y campos de varios valores (choice/multi) que cuentan como "pendientes". */
export const isChoice = (d: VarDef | undefined) => !!d && (d.kind === 'choice' || d.kind === 'multi');

/** Reemplaza los campos ⟦clave⟧ dentro de una opción; si el campo está vacío, quita también su unidad. */
export function fillOpt(n: NoteState, v: string): string {
  if (!v || v.indexOf('⟦') < 0) return v;
  let out = '', last = 0, drop = false;
  for (const m of v.matchAll(OPF)) {
    let seg = v.slice(last, m.index);
    if (drop) { seg = seg.replace(UNIT_RE, ''); drop = false; }
    out += seg;
    const fv = n.values[m[1]];
    if (fv != null && String(fv).trim()) out += fv;
    else drop = true;
    last = m.index! + m[0].length;
  }
  let tail = v.slice(last);
  if (drop) tail = tail.replace(UNIT_RE, '');
  return (out + tail).replace(/\s{2,}/g, ' ').trim();
}

/** Texto de la opción para mostrar (los campos internos se ven como "…"). */
export const optLabel = (v: string) => v.replace(OPF, '…');

export function valText(t: Template, n: NoteState, k: string, val: Value): string {
  const d = t.vars[k];
  if (d.kind === 'choice' && val) val = fillOpt(n, val as string);
  if (d.kind === 'multi' && val) val = (val as string[]).map((x) => fillOpt(n, x));
  if (d.kind === 'multi' && d.list) {
    const L = val as string[] | undefined;
    return L && L.length ? '\n' + L.map((x) => '- ' + cap(x)).join('\n') : '';
  }
  if (d.kind === 'quest') return questText(d.qid, val as QuestValue);
  if (d.kind === 'opioid') return opioidText(val as OpioidValue);
  if (d.kind === 'la') return laText(val as LAValue);
  if (d.kind === 'multi') return joinList((val as string[]) || [], t.lang);
  return (val as string) || '';
}

/* ---------------- párrafos ---------------- */

export interface Parts { lits: string[]; toks: { k: string; c: boolean }[] }
const partsCache = new Map<string, Parts>();
export function parts(b: string): Parts {
  let p = partsCache.get(b);
  if (p) return p;
  const lits: string[] = [], toks: Parts['toks'] = [];
  let last = 0;
  for (const m of b.matchAll(TOK)) {
    lits.push(b.slice(last, m.index));
    toks.push({ k: m[1], c: !!m[2] });
    last = m.index! + m[0].length;
  }
  lits.push(b.slice(last));
  p = { lits, toks };
  partsCache.set(b, p);
  return p;
}

/** Limpieza tipográfica final de un párrafo. */
export function tidy(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/["“]\s*["”]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +\n/g, '\n')
    .replace(/ +([.,;:)])/g, '$1')
    .replace(/[:,;]\s*([.,;])/g, '$1')
    .replace(/\.{2,}/g, '.')
    .trim()
    .replace(/^[,;:.]\s*/, '')
    .replace(/^\p{Ll}/u, (c) => c.toUpperCase());
}

/** Texto de un párrafo. Las opciones sin elegir salen como [etiqueta]; los campos vacíos desaparecen. */
export interface TextOpts {
  /** Quita las frases que tienen opciones sin elegir (en vez de dejar [etiqueta]). */
  omitPending?: boolean;
}

/** Marcas internas de lo que el usuario sí llenó (para no borrar frases con datos al omitir pendientes). */
const FILL_A = '\u0002', FILL_B = '\u0003';

/**
 * Al copiar sin pendientes: una frase sin nada llenado que tenga opciones sin elegir se quita entera;
 * si la frase tiene datos llenados, se conserva y solo se quita el hueco.
 */
function dropPendingSentences(s: string): string {
  if (s.indexOf(PEND) < 0) return s.replace(/[\u0002\u0003]/g, '');
  const out: string[] = [];
  for (const line of s.split('\n')) {
    const parts = line.split(/(?<=[.!?])\s+(?=[\p{Lu}¿¡"(*\u0002])/u);
    const kept = parts.filter((x) => x.indexOf(PEND) < 0 || x.indexOf(FILL_A) >= 0).map((x) => x.split(PEND).join(''));
    if (kept.length) out.push(kept.join(' '));
  }
  return out.join('\n').replace(/[\u0002\u0003]/g, '').replace(/ +([,;:])/g, '$1').replace(/([,;:])\s*([,;:.])/g, '$2');
}

export function paraText(t: Template, n: NoteState, b: string, pk: string, opts: TextOpts = {}): string {
  const p = parts(b), Ls = n.lit[pk] || p.lits, dr = n.drop[pk] || {};
  let s = '', dropU = false;
  for (let i = 0; i < Ls.length; i++) {
    let L = Ls[i];
    if (dropU) { L = L.replace(UNIT_RE, ''); dropU = false; }
    s += L;
    if (i < p.toks.length && !dr[i]) {
      const { k, c } = p.toks[i], d = t.vars[k];
      if (!d) continue;
      const v = n.values[k];
      if (d.kind === 'text' && !isFilled(d, v)) dropU = true;
      if (!isFilled(d, v)) s += isChoice(d) ? (opts.omitPending ? PEND : '[' + d.label + ']') : '';
      else {
        const x = c ? cap(valText(t, n, k, v)) : valText(t, n, k, v);
        s += opts.omitPending && d.kind !== 'quest' && d.kind !== 'opioid' && d.kind !== 'la' ? FILL_A + x + FILL_B : x;
      }
    }
  }
  return tidy(opts.omitPending ? dropPendingSentences(s) : s);
}

/* ---------------- nota completa ---------------- */

export interface Ctx {
  note(t: Template): NoteState;
  vis(t: Template): Visibility | undefined;
  /** Plantilla de un bloque insertado (id "ins_<uid>"). */
  inserted(uid: string, base: string): Template | undefined;
}

export const baseId = (t: Template) => t.baseId || t.id;

export function secOn(vis: Visibility | undefined, s: Section): boolean {
  if (vis && vis.sec && s.id in vis.sec) return vis.sec[s.id];
  return s.on !== false;
}
export const parHidden = (vis: Visibility | undefined, sid: string, i: number) => !!(vis && vis.par && vis.par[sid + ':' + i]);

export interface Part { txt: string; tid: string; pk: string; head: boolean }

export function toParts(t: Template, ctx: Ctx, opts: TextOpts = {}): Part[] {
  const n = ctx.note(t), vis = ctx.vis(t), out: Part[] = [];
  for (const s of t.sections) {
    if (!secOn(vis, s)) continue;
    s.blocks.forEach((b, i) => {
      if (parHidden(vis, s.id, i)) return;
      const pk = s.id + ':' + i, x = paraText(t, n, b, pk, opts);

      if (x) out.push({ txt: x, tid: t.id, pk, head: HEADING_RE.test(b.trim()) });
    });
    for (const it of n.items[s.id] || []) {
      if (it.k === 'x') { if (it.v.trim()) out.push({ txt: it.v.trim(), tid: t.id, pk: 'x:' + it.id, head: false }); }
      else if (!t.virtual) {
        const v = ctx.inserted(it.uid, it.base);
        if (v) out.push(...toParts(v, ctx, opts));
      }
    }
  }
  return out;
}

export const toText = (t: Template, ctx: Ctx, opts: TextOpts = {}) => toParts(t, ctx, opts).map((x) => x.txt).join('\n\n');

/** Versión HTML de la nota (negritas y párrafos) para historias clínicas que aceptan formato. */
export function toHTML(parts: Part[]): string {
  const esc = (x: string) => x.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
  return parts.map((p) => {
    const body = esc(p.txt).replace(/\n/g, '<br>');
    return p.head ? `<p><b>${body}</b></p>` : `<p>${body}</p>`;
  }).join('');
}

/* ---------------- estado inicial ---------------- */

export function freshNote(t: Template, sticky: Record<string, Value> = {}, today = new Date(), profile?: Profile): NoteState {
  const v: Record<string, Value> = {};
  const signer = signerValue(profile, t.lang);
  for (const [k, d] of Object.entries(t.vars)) {
    if (d.def != null) v[k] = d.def;
    if (d.today) v[k] = todayStr(t.lang, today);
    if (d.now) v[k] = timeStr(today);
    if (d.kind === 'multi') v[k] = [];
    if (d.kind === 'opioid') v[k] = opioidDefault();
    if (d.kind === 'la') v[k] = laDefault();
    if (d.kind === 'quest') v[k] = { a: {}, open: true };
  }
  for (const k of t.sticky) if (sticky[k] != null && t.vars[k]) v[k] = sticky[k];
  // el perfil manda sobre la firma recordada o escrita en la plantilla
  if (signer) for (const [k, d] of Object.entries(t.vars)) if (d.kind === 'text' && SIGNER_RE.test(d.label)) v[k] = signer;
  return { values: v, custom: {}, lit: {}, drop: {}, items: {} };
}
