/** Acciones de alto nivel: editor de plantillas y notas compuestas. */
import { builtinTemplate, comboToRecord, isBuiltinId, type CatalogTemplate } from '../state/catalog';
import { uid } from '../state/noteOps';
import { noteOf, openTpl, saveCustom, toast, updateSettings, useApp, type EditorDraft } from '../state/store';
import type { Template } from '../engine/types';

export const STARTER = `## Procedimiento
**Procedimiento:** [lado: derecho / izquierdo] {procedimiento}, con [@aguja: aguja 22 G / aguja 25 G].

**Técnica:** Se realiza asepsia y antisepsia. [* sin complicaciones / con dolor transitorio en el sitio de punción].

## Plan
Control en [2 semanas / 4 semanas]. {@médico=Dr. Mateo Uribe Moreno}. {fecha=hoy}.
`;

export const BLOCK_STARTER = `## Bloque
**Subtítulo del bloque**

Escribe aquí el texto del bloque. Puedes agregar [opciones / como estas] o {campos} si los necesitas. Si no quieres subtítulo, borra la primera línea.
`;

export function openEditor(d: EditorDraft) {
  useApp.setState({ editing: d, view: 'editor', pickOpen: false, hint: null });
  window.scrollTo({ top: 0 });
}

export function newTemplate(kind: 'nota' | 'bloque') {
  openEditor(kind === 'nota'
    ? { id: null, name: '', short: '', group: 'Mis plantillas', lang: 'es', source: STARTER, use: 'nota', insMode: 'seccion', title: '', normal: false }
    : { id: null, name: '', short: '', group: 'Mis bloques', lang: 'es', source: BLOCK_STARTER, use: 'bloque', insMode: 'texto', title: '', normal: false });
}

export function openEditorFor(id: string) {
  const { custom } = useApp.getState();
  const c = custom[id];
  const orig = builtinTemplate(id);
  if (orig) {
    openEditor({
      id, builtin: true, overridden: !!c,
      name: c ? c.name : orig.name, short: c ? c.short || '' : orig.short, group: orig.group, lang: orig.lang,
      source: c ? c.source || '' : orig.source, use: c?.use || orig.use, insMode: c?.insMode || orig.insMode,
      title: c?.title || '', normal: orig.normal || !!c?.normal, normalLocked: orig.normal,
    });
    return;
  }
  if (!c) return;
  openEditor({
    id: c.id, name: c.name, short: c.short || '', group: c.group || 'Mis plantillas', lang: c.lang || 'es', source: c.source || '',
    use: c.use || 'nota', insMode: c.insMode || 'seccion', title: c.title || '', normal: !!c.normal,
  });
}

export function saveEditor(d: EditorDraft, asNew = false): string | null {
  const name = d.name.trim();
  if (!name) return 'Ponle un nombre a la plantilla.';
  if (!d.source.trim()) return 'La plantilla está vacía.';
  const custom = { ...useApp.getState().custom };
  const overriding = d.builtin && !asNew;
  const id = overriding ? d.id! : !asNew && d.id ? d.id : 'u_' + uid();
  custom[id] = {
    id, name, short: d.short.trim(), group: d.group.trim() || 'Mis plantillas', lang: d.lang, source: d.source,
    use: d.use, insMode: d.insMode, title: d.title, normal: d.normal, updated: Date.now(),
    ...(overriding ? { override: true } : {}),
  };
  saveCustom(custom);
  // la nota abierta con la versión anterior se reinicia
  const notes = { ...useApp.getState().notes };
  delete notes[id];
  useApp.setState({ notes, editing: null });
  if (d.use === 'bloque') { useApp.setState({ view: 'note' }); updateSettings((s) => { s.ptab = 'blk'; }); }
  openTpl(id);
  toast(overriding ? 'Tu versión de la plantilla quedó guardada.' : 'Plantilla guardada.');
  return null;
}

export function deleteCustom(id: string) {
  const custom = { ...useApp.getState().custom };
  delete custom[id];
  saveCustom(custom);
  updateSettings((s) => { s.fav = s.fav.filter((x) => x !== id); s.recent = s.recent.filter((x) => x !== id); });
  const { catalog } = useApp.getState();
  useApp.setState({ editing: null, view: 'note', tplId: catalog.list[0].id });
}

export function restoreOriginal(id: string) {
  if (!isBuiltinId(id)) return;
  const custom = { ...useApp.getState().custom };
  delete custom[id];
  saveCustom(custom);
  const notes = { ...useApp.getState().notes };
  delete notes[id];
  useApp.setState({ notes, editing: null });
  updateSettings((s) => { delete s.vis[id]; });
  openTpl(id);
  toast('Plantilla original restaurada');
}

/* ---------------- notas compuestas ---------------- */

/** Bloques insertados en la nota, con su sección. */
export function blocksOfNote(t: Template) {
  const n = noteOf(t), out: { section: string; title: string; template: string }[] = [];
  for (const s of t.sections) for (const it of n.items[s.id] || []) if (it.k === 'b') out.push({ section: s.id, title: s.title, template: it.base });
  return out;
}

export function saveAsCombo(t: CatalogTemplate, update: boolean) {
  const blocks = blocksOfNote(t);
  if (!blocks.length) { toast('Inserta al menos un bloque en la nota para guardarla como nota compuesta.', true); return; }
  if (update && t.combo) {
    writeCombo(t.combo.id, t.combo.name, t.combo.short || '', t.combo.base, blocks);
    toast('Nota compuesta actualizada.');
    return;
  }
  useApp.setState({ modal: { kind: 'combo', tplId: t.id } });
}

export function writeCombo(id: string | null, name: string, short: string, base: string, blocks: ReturnType<typeof blocksOfNote>) {
  const cid = id || 'k_' + uid();
  const custom = { ...useApp.getState().custom };
  custom[cid] = comboToRecord({ id: cid, name, short, base, blocks, updated: Date.now() });
  saveCustom(custom);
  return cid;
}
