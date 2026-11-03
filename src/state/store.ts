/** Estado global de la aplicación. */
import { produce } from 'immer';
import { create } from 'zustand';
import { FREE_NOTE_ID } from '../content/builtin';
import { baseId, freshNote, isChoice, isFilled, parHidden, parts, secOn, toHTML, toParts, type Ctx, type TextOpts } from '../engine/text';
import type { Item, NoteState, Template, Value, Visibility } from '../engine/types';
import { buildCatalog, type Catalog, type CatalogTemplate, type CustomRecord } from './catalog';
import { addCustomOption, allNormal, pendingOne, stickyValues, toggleOption, uid } from './noteOps';
import { localBackend, migrateSnips, type Persisted, type Settings, type StorageBackend } from './storage';

export type View = 'note' | 'editor' | 'about' | 'profile';

export interface EditorDraft {
  id: string | null;
  builtin?: boolean;
  overridden?: boolean;
  name: string;
  short: string;
  group: string;
  lang: 'es' | 'en';
  source: string;
  use: 'nota' | 'bloque' | 'ambos';
  insMode: 'seccion' | 'texto';
  title: string;
  normal: boolean;
  normalLocked?: boolean;
}

export interface Hint { label: string; text: string; warn?: boolean }
export interface Toast { msg: string; amber?: boolean; action?: { label: string; fn: () => void }; id: number; sticky?: boolean }
export interface Palette { host: string; sid: string; idx: number }
export type Modal =
  | { kind: 'keys'; welcome?: boolean }
  | { kind: 'combo'; tplId: string }
  | { kind: 'copy' };

interface Snapshot { notes: Record<string, NoteState>; vis: Record<string, Visibility>; started: number | null }

interface AppState {
  backend: StorageBackend;
  settings: Settings;
  custom: Record<string, CustomRecord>;
  catalog: Catalog;
  tplId: string;
  notes: Record<string, NoteState>;
  /** Momento en que se empezó a escribir sobre el paciente actual (null = nada escrito). */
  started: number | null;
  view: View;
  query: string;
  pickOpen: boolean;
  editing: EditorDraft | null;
  hint: Hint | null;
  toast: Toast | null;
  palette: Palette | null;
  modal: Modal | null;
  hist: { u: Snapshot[]; r: Snapshot[] };
}

/* ---------------- arranque ---------------- */

const backend = localBackend;
const initial: Persisted = backend.load();
if (migrateSnips(initial)) { backend.saveCustom(initial.custom); backend.saveSettings(initial.settings); }

/**
 * La nota en curso vive solo en esta pestaña (sessionStorage): sobrevive a una recarga accidental,
 * pero se borra al cerrar la pestaña. Así no quedan datos de pacientes guardados en el equipo.
 */
const SESSION_KEY = 'notarium:session';
function loadSession(): { notes: Record<string, NoteState>; started: number | null; tplId?: string } {
  try {
    const o = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (o && o.notes) return o;
  } catch { /* sin sesión */ }
  return { notes: {}, started: null };
}
const session = loadSession();

export const useApp = create<AppState>(() => {
  const catalog = buildCatalog(initial.custom);
  const recent = initial.settings.recent.find((id) => catalog.byId.has(id));
  const tplId = session.tplId && catalog.byId.has(session.tplId) ? session.tplId : recent || catalog.list[0].id;
  return {
    backend,
    settings: initial.settings,
    custom: initial.custom,
    catalog,
    tplId,
    notes: session.notes,
    started: session.started,
    view: 'note',
    query: '',
    pickOpen: false,
    editing: null,
    hint: null,
    toast: null,
    palette: null,
    modal: null,
    hist: { u: [], r: [] },
  };
});

const get = useApp.getState;
const set = useApp.setState;

let sessionTimer: ReturnType<typeof setTimeout> | undefined;
function saveSession() {
  clearTimeout(sessionTimer);
  const s = get();
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ notes: s.notes, started: s.started, tplId: s.tplId })); } catch { /* lleno o bloqueado */ }
}
useApp.subscribe((s, prev) => {
  if (s.notes === prev.notes && s.started === prev.started && s.tplId === prev.tplId) return;
  clearTimeout(sessionTimer);
  sessionTimer = setTimeout(saveSession, 400);
});
// al recargar o cerrar, se guarda lo último que se escribió
if (typeof window !== 'undefined') window.addEventListener('pagehide', saveSession);

/* Si cambia el perfil, las notas que aún no se han tocado se vuelven a crear con la nueva firma. */
useApp.subscribe((s, prev) => {
  if (s.settings.profile === prev.settings.profile) return;
  freshCache.clear();
  set({ notes: { ...s.notes } });
});

/* Otra pestaña cambió plantillas o preferencias: se recargan aquí. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (!e.key || !e.key.startsWith('notarium:v2:')) return;
    const p = backend.load();
    set({ settings: p.settings, custom: p.custom, catalog: buildCatalog(p.custom) });
  });
}

/* ---------------- plantillas y notas ---------------- */

const virtCache = new WeakMap<Catalog, Map<string, Template>>();
/** Plantilla de un bloque insertado: copia de la base con id propio. */
export function insertedTpl(u: string, base: string, catalog = get().catalog): Template | undefined {
  let m = virtCache.get(catalog);
  if (!m) virtCache.set(catalog, (m = new Map()));
  const key = u + '|' + base;
  let v = m.get(key);
  if (!v) {
    const bt = catalog.byId.get(base);
    if (!bt) return undefined;
    v = { ...bt, id: 'ins_' + u, baseId: base, virtual: true };
    m.set(key, v);
  }
  return v;
}

export function tplById(id: string): CatalogTemplate | Template | undefined {
  const s = get();
  if (id.startsWith('ins_')) {
    for (const n of Object.values(s.notes)) for (const L of Object.values(n.items)) for (const it of L)
      if (it.k === 'b' && 'ins_' + it.uid === id) return insertedTpl(it.uid, it.base);
    return undefined;
  }
  return s.catalog.byId.get(id);
}

export const currentTpl = (): CatalogTemplate =>
  get().catalog.byId.get(get().tplId) || get().catalog.list[0];

export function freshFor(t: CatalogTemplate | Template): NoteState {
  const s = get();
  const n = freshNote(t, s.settings.sticky[baseId(t)] || {}, new Date(), s.settings.profile);
  const combo = (t as CatalogTemplate).combo;
  if (combo) {
    for (const bk of combo.blocks) {
      if (!s.catalog.byId.has(bk.template)) continue;
      const sec = t.sections.find((x) => bk.title && x.title === bk.title) || t.sections.find((x) => x.id === bk.section) || t.sections[t.sections.length - 1];
      if (!sec) continue;
      (n.items[sec.id] = n.items[sec.id] || []).push({ k: 'b', uid: uid(), base: bk.template });
    }
  }
  return n;
}

/**
 * Notas sin tocar todavía: se crean una vez y se reutilizan para que la referencia sea estable
 * (los componentes solo se vuelven a dibujar cuando su parte de la nota cambia).
 */
const freshCache = new Map<string, NoteState>();
export function noteOf(t: Template): NoteState {
  const n = get().notes[t.id];
  if (n) return n;
  let f = freshCache.get(t.id);
  if (!f) { f = freshFor(t); freshCache.set(t.id, f); }
  return f;
}
export const visOf = (t: Template): Visibility | undefined => get().settings.vis[baseId(t)];

export function makeCtx(): Ctx {
  return { note: noteOf, vis: visOf, inserted: (u, b) => insertedTpl(u, b) };
}

/** La plantilla y todos sus bloques insertados visibles. */
export function allBlocks(t: Template): Template[] {
  const out: Template[] = [t];
  if (t.virtual) return out;
  const n = noteOf(t), vis = visOf(t);
  for (const s of t.sections) {
    if (!secOn(vis, s)) continue;
    for (const it of n.items[s.id] || []) if (it.k === 'b') { const v = insertedTpl(it.uid, it.base); if (v) out.push(v); }
  }
  return out;
}

export const pendingCount = (t: Template) => allBlocks(t).reduce((a, b) => a + pendingOne(b, noteOf(b), visOf(b)), 0);
export const noteParts = (t: Template, opts?: TextOpts) => toParts(t, makeCtx(), opts);
export const noteText = (t: Template, opts?: TextOpts) => noteParts(t, opts).map((x) => x.txt).join('\n\n');

export interface PendingItem { tid: string; key: string; label: string; where: string }
/** Opciones sin elegir, en el orden en que aparecen, con su sección o bloque. */
export function pendingList(t: Template): PendingItem[] {
  const out: PendingItem[] = [];
  const walk = (b: Template, prefix: string) => {
    const n = noteOf(b), vis = visOf(b), seen = new Set<string>();
    for (const s of b.sections) {
      if (!secOn(vis, s)) continue;
      s.blocks.forEach((blk, i) => {
        if (parHidden(vis, s.id, i)) return;
        const dr = n.drop[s.id + ':' + i] || {};
        parts(blk).toks.forEach((x, j) => {
          const d = b.vars[x.k];
          if (dr[j] || seen.has(x.k) || !isChoice(d) || isFilled(d, n.values[x.k])) return;
          seen.add(x.k);
          out.push({ tid: b.id, key: x.k, label: d.label, where: prefix + s.title });
        });
      });
      if (!b.virtual) for (const it of n.items[s.id] || []) if (it.k === 'b') { const v = insertedTpl(it.uid, it.base); if (v) walk(v, v.name + ' · '); }
    }
  };
  walk(t, '');
  return out;
}

/* ---------------- historial (deshacer / rehacer) ---------------- */

/** Las notas son inmutables (immer): una foto del estado es solo guardar referencias. */
const snap = (): Snapshot => ({ notes: get().notes, vis: get().settings.vis, started: get().started });
let typingTimer: ReturnType<typeof setTimeout> | null = null;

export function pushHist() {
  const h = get().hist;
  const u = [...h.u, snap()];
  if (u.length > 100) u.shift();
  set({ hist: { u, r: [] } });
}
/** Al escribir, agrupa las teclas en un solo paso de deshacer. */
export function pushTyping() {
  if (!typingTimer) pushHist();
  else clearTimeout(typingTimer);
  typingTimer = setTimeout(() => (typingTimer = null), 1200);
}
function restore(o: Snapshot) {
  freshCache.clear();
  set({ notes: o.notes, started: o.started });
  saveSettings({ ...get().settings, vis: o.vis });
}
export function undo() {
  const h = get().hist;
  if (!h.u.length) return toast('No hay nada que deshacer');
  const cur = snap();
  restore(h.u[h.u.length - 1]);
  set({ hist: { u: h.u.slice(0, -1), r: [...h.r, cur] } });
}
export function redo() {
  const h = get().hist;
  if (!h.r.length) return toast('No hay nada que rehacer');
  const cur = snap();
  restore(h.r[h.r.length - 1]);
  set({ hist: { u: [...h.u, cur], r: h.r.slice(0, -1) } });
}

/* ---------------- persistencia ---------------- */

export function saveSettings(s: Settings) {
  set({ settings: s });
  get().backend.saveSettings(s);
}
export function updateSettings(fn: (s: Settings) => void) {
  saveSettings(produce(get().settings, fn));
}
export function saveCustom(c: Record<string, CustomRecord>) {
  freshCache.clear();
  set({ custom: c, catalog: buildCatalog(c) });
  get().backend.saveCustom(c);
}
export function replaceAll(p: Persisted) {
  freshCache.clear();
  set({ custom: p.custom, catalog: buildCatalog(p.custom), notes: {}, started: null, hist: { u: [], r: [] } });
  saveSettings(p.settings);
  get().backend.saveCustom(p.custom);
}

/* ---------------- edición de la nota ---------------- */

/** Modifica la nota de una plantilla (con paso de deshacer salvo hist: false). */
export function editNote(t: Template, fn: (n: NoteState) => void, opts: { hist?: boolean | 'typing' } = {}) {
  if (opts.hist === 'typing') pushTyping();
  else if (opts.hist !== false) pushHist();
  const n = produce(noteOf(t), fn);
  set({ notes: { ...get().notes, [t.id]: n }, started: get().started ?? Date.now() });
  if (t.sticky.length) {
    const sv = stickyValues(t, n);
    const id = baseId(t);
    if (JSON.stringify(sv) !== JSON.stringify(get().settings.sticky[id] || {})) updateSettings((s) => { s.sticky[id] = sv as never; });
  }
}

export function setValue(t: Template, k: string, v: Value, typing = true) {
  editNote(t, (n) => { n.values[k] = v; }, { hist: typing ? 'typing' : true });
}

export function pickOption(t: Template, k: string, v: string) {
  let now = false;
  editNote(t, (n) => { now = toggleOption(t, n, k, v); });
  const d = t.vars[k], o = d.options?.find((x) => x.v === v);
  if (now && o?.hint) showHint({ label: d.label, text: o.hint, warn: o.warn });
  else if (now && d.hint) showHint({ label: d.label, text: d.hint });
  else showHint(null);
}

export function clearValue(t: Template, k: string) {
  editNote(t, (n) => { n.values[k] = t.vars[k].kind === 'multi' ? [] : undefined; });
}

export function addOption(t: Template, k: string, v: string) {
  editNote(t, (n) => addCustomOption(t, n, k, v));
}

export function dropField(t: Template, pk: string, j: number) {
  editNote(t, (n) => { (n.drop[pk] = n.drop[pk] || {})[j] = true; });
  toast('Campo quitado de esta nota. Usa ↺ en el párrafo para recuperarlo.');
}
export function restorePar(t: Template, pk: string) {
  editNote(t, (n) => { delete n.lit[pk]; delete n.drop[pk]; });
}

export function toggleSection(t: Template, sid: string, on: boolean) {
  pushHist();
  updateSettings((s) => { const v = (s.vis[baseId(t)] = s.vis[baseId(t)] || { sec: {}, par: {} }); v.sec = v.sec || {}; v.sec[sid] = on; });
}
export function togglePar(t: Template, pk: string) {
  pushHist();
  updateSettings((s) => {
    const v = (s.vis[baseId(t)] = s.vis[baseId(t)] || { sec: {}, par: {} });
    v.par = v.par || {};
    if (v.par[pk]) delete v.par[pk]; else v.par[pk] = true;
  });
}

/** "Todo normal" en la nota (bloques con normal), en un bloque, o solo en una sección. */
export function markAllNormal(t: Template, sid?: string) {
  pushHist();
  let c = 0;
  const notes = { ...get().notes };
  const targets = sid || t.virtual ? [t] : allBlocks(t).filter((b) => b.normal);
  for (const b of targets) {
    const vis = visOf(b);
    const only: Template = sid ? { ...b, sections: b.sections.filter((s) => s.id === sid) } : b;
    notes[b.id] = produce(noteOf(b), (n) => { c += allNormal(only, n as NoteState, vis); });
  }
  set({ notes, started: get().started ?? Date.now() });
  toast(c ? 'Lo pendiente quedó normal. Toca solo los hallazgos.' : 'No quedaba nada por marcar.');
}

/** Vuelve a empezar la nota abierta (mismo paciente). */
export function newNote() {
  const t = currentTpl();
  pushHist();
  const notes = { ...get().notes };
  for (const b of allBlocks(t)) delete notes[b.id];
  freshCache.clear();
  set({ notes, hint: null });
}

/** Borra todas las notas abiertas: lo único que se conserva es la técnica recordada (@). */
export function newPatient(silent = false) {
  if (!Object.keys(get().notes).length && !get().started) { if (!silent) toast('Listo para el siguiente paciente.'); return; }
  pushHist();
  freshCache.clear();
  set({ notes: {}, started: null, hint: null, modal: null });
  useSheetReset();
  window.scrollTo({ top: 0 });
  if (!silent) toast('Paciente nuevo: se borraron todas las notas abiertas.', false, { label: 'Deshacer', fn: undo });
}
let useSheetReset: () => void = () => {};
export const onPatientReset = (fn: () => void) => { useSheetReset = fn; };

/* ---------------- bloques y textos insertados ---------------- */

function itemsEdit(host: Template, fn: (items: NoteState['items']) => void) {
  editNote(host, (n) => fn(n.items));
}

export function addItem(host: Template, sid: string, idx: number | null, it: Item) {
  itemsEdit(host, (items) => {
    const L = (items[sid] = items[sid] || []);
    L.splice(Math.max(0, Math.min(idx == null ? L.length : idx, L.length)), 0, it);
  });
  if (it.k === 'b') updateSettings((s) => { const u = (s.useBlk = s.useBlk || {}); u[it.base] = (u[it.base] || 0) + 1; });
  return it;
}
export const addBlock = (host: Template, sid: string, idx: number | null, base: string) =>
  addItem(host, sid, idx, { k: 'b', uid: uid(), base });
export const addText = (host: Template, sid: string, idx: number | null, v = '') =>
  addItem(host, sid, idx, { k: 'x', id: uid(), v });

export function setItemText(host: Template, sid: string, id: string, v: string) {
  editNote(host, (n) => { const it = (n.items[sid] || []).find((x) => x.k === 'x' && x.id === id); if (it && it.k === 'x') it.v = v; }, { hist: 'typing' });
}

export function moveItem(host: Template, sid: string, i: number, dir: -1 | 1) {
  const vis = visOf(host);
  const secs = host.sections.filter((s) => secOn(vis, s));
  const L = noteOf(host).items[sid] || [];
  const j = i + dir;
  if (j < 0 || j >= L.length) {
    const si = secs.findIndex((s) => s.id === sid), ns = secs[si + dir];
    if (!ns) return toast(dir < 0 ? 'Ya está al inicio de la nota' : 'Ya está al final de la nota');
    itemsEdit(host, (items) => {
      const [it] = items[sid].splice(i, 1);
      const L2 = (items[ns.id] = items[ns.id] || []);
      if (dir < 0) L2.push(it); else L2.unshift(it);
    });
    return;
  }
  itemsEdit(host, (items) => { const [it] = items[sid].splice(i, 1); items[sid].splice(j, 0, it); });
}

export function removeItem(host: Template, sid: string, i: number) {
  const it = (noteOf(host).items[sid] || [])[i];
  if (!it) return;
  itemsEdit(host, (items) => { items[sid].splice(i, 1); });
  if (it.k === 'b') { const notes = { ...get().notes }; delete notes['ins_' + it.uid]; set({ notes }); }
  toast(it.k === 'b' ? 'Bloque quitado' : 'Texto quitado', false, { label: 'Deshacer', fn: undo });
}

export function duplicateItem(host: Template, sid: string, i: number) {
  const it = (noteOf(host).items[sid] || [])[i];
  if (!it || it.k !== 'b') return;
  const nu = uid();
  const src = get().notes['ins_' + it.uid];
  itemsEdit(host, (items) => { items[sid].splice(i + 1, 0, { k: 'b', uid: nu, base: it.base }); });
  if (src) set({ notes: { ...get().notes, ['ins_' + nu]: src } });
  toast('Copia creada debajo. Revisa lo que cambia, por ejemplo el lado.');
}

export function toggleItemMin(host: Template, sid: string, i: number) {
  editNote(host, (n) => { const it = n.items[sid]?.[i]; if (it && it.k === 'b') it.min = !it.min; }, { hist: false });
}

/* ---------------- navegación ---------------- */

export function openTpl(id: string) {
  const t = get().catalog.byId.get(id);
  if (!t) return;
  updateSettings((s) => { s.recent = [id, ...s.recent.filter((x) => x !== id)].slice(0, 12); });
  set({ tplId: id, view: 'note', pickOpen: false, hint: null });
  window.scrollTo({ top: 0 });
}
export const openFree = () => openTpl(FREE_NOTE_ID);
export const setView = (view: View) => set({ view, pickOpen: false, hint: null });

/* ---------------- avisos ---------------- */

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string, amber = false, action?: Toast['action'], ms?: number) {
  clearTimeout(toastTimer);
  set({ toast: { msg, amber, action, id: Date.now() } });
  toastTimer = setTimeout(() => set({ toast: null }), ms ?? (action ? 7000 : 3500));
}
export const closeToast = () => set({ toast: null });
export const showHint = (hint: Hint | null) => set({ hint });

/* ---------------- copiar ---------------- */

export async function copyText(text: string, html?: string): Promise<boolean> {
  try {
    if (html && typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      await navigator.clipboard.write([new ClipboardItem({
        'text/plain': new Blob([text], { type: 'text/plain' }),
        'text/html': new Blob([html], { type: 'text/html' }),
      })]);
      return true;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* sigue */ }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

/**
 * Copiar la nota. Si hay opciones sin elegir, se abre la lista para completarlas,
 * copiar sin esas frases o copiar igual (con [corchetes]).
 */
export async function copyNote(mode: 'check' | 'force' | 'omit' = 'check') {
  const t = currentTpl();
  if (mode === 'check' && pendingCount(t)) { set({ modal: { kind: 'copy' } }); return; }
  const P = noteParts(t, { omitPending: mode === 'omit' });
  const text = P.map((x) => x.txt).join('\n\n');
  const ok = await copyText(text, toHTML(P));
  set({ modal: null });
  if (!ok) return toast('No se pudo copiar', true);
  toast(mode === 'omit' ? 'Copiada sin las frases pendientes.' : 'Nota copiada. Pégala en la historia clínica.', false,
    { label: 'Paciente nuevo', fn: () => newPatient() }, 12000);
}
