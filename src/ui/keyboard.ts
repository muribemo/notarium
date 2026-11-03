/** Atajos de teclado y navegación entre pendientes. */
import { copyNote, currentTpl, noteOf, openFree, redo, undo, useApp, editNote, tplById } from '../state/store';
import { openPalette, useSheetUI } from './Sheet';
import { secOn } from '../engine/text';

const stops = () => [...document.querySelectorAll<HTMLElement>('#sheet .grp[data-gk], #sheet .fld')];
const isPending = (el: HTMLElement) => (el.classList.contains('grp') ? !el.classList.contains('chosen') : !(el as HTMLInputElement).value.trim());

/** Lleva el foco al siguiente (o anterior) campo pendiente. */
export function goNextPending(dir: 1 | -1, from?: Element | null) {
  const L = stops();
  if (!L.length) return;
  const cur = from ? L.indexOf(from as HTMLElement) : -1;
  const order = dir > 0
    ? [...L.slice(cur + 1), ...L.slice(0, cur + 1)]
    : [...L.slice(0, Math.max(cur, 0)).reverse(), ...L.slice(Math.max(cur, 0)).reverse()];
  const next = order.find(isPending) || (cur < 0 ? L[0] : null);
  if (!next) { useApp.setState({}); return; }
  next.focus({ preventScroll: true });
  next.scrollIntoView({ block: 'center', behavior: 'smooth' });
  if (next.classList.contains('cmp')) useSheetUI.setState({ openGrp: (next.dataset.tid || '') + '|' + next.dataset.gk });
}

export function onKeyDown(e: KeyboardEvent) {
  const s = useApp.getState();
  const tg = e.target as HTMLElement;
  const typing = !!tg.matches && (tg.matches('input,textarea,select') || tg.isContentEditable);
  const mod = e.ctrlKey || e.metaKey;

  if (e.key === 'Escape') {
    if (s.palette) { useApp.setState({ palette: null }); return; }
    if (s.modal) { useApp.setState({ modal: null }); return; }
    if (useSheetUI.getState().openGrp) { useSheetUI.setState({ openGrp: null }); return; }
    if (s.pickOpen) { useApp.setState({ pickOpen: false }); return; }
  }
  if (s.palette || s.modal) return;

  if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); document.getElementById('q')?.focus(); return; }
  if (e.altKey && e.key.toLowerCase() === 'n') { e.preventDefault(); openFree(); return; }
  if (s.view !== 'note') return;

  if (mod && e.key === 'Enter') { e.preventDefault(); copyNote(); return; }
  if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
  if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); return; }

  const inSheet = !!tg.closest?.('#sheet');
  if (e.key === 'Tab' && (inSheet || tg === document.body) && !tg.matches('textarea')) {
    e.preventDefault();
    goNextPending(e.shiftKey ? -1 : 1, inSheet ? tg.closest('.grp[data-gk], .fld') : null);
    return;
  }
  if (typing) return;

  const grp = tg.closest?.('.grp[data-gk]') as HTMLElement | null;
  if (grp && /^[1-9]$/.test(e.key)) {
    const b = grp.querySelector<HTMLButtonElement>(`.opt[data-n="${e.key}"]`);
    if (b) { e.preventDefault(); b.click(); setTimeout(() => goNextPending(1, document.querySelector(`.grp[data-gk="${grp.dataset.gk}"][data-tid="${grp.dataset.tid}"]`)), 0); }
    return;
  }
  if (grp && (e.key === 'Backspace' || e.key === 'Delete')) {
    e.preventDefault();
    const t = tplById(grp.dataset.tid || '');
    const k = grp.dataset.gk!;
    if (t) editNote(t, (n) => { n.values[k] = t.vars[k].kind === 'multi' ? [] : undefined; });
    return;
  }
  if (e.key === '/') {
    e.preventDefault();
    const t = currentTpl(), n = noteOf(t), vis = useApp.getState().settings.vis[t.baseId || t.id];
    const secEl = tg.closest?.('section[data-sid]') as HTMLElement | null;
    let sid = secEl && secEl.closest('[data-tid]')?.getAttribute('data-tid') === t.id ? secEl.dataset.sid! : null;
    if (!sid) { const on = t.sections.filter((x) => secOn(vis, x)); sid = (on[on.length - 1] || t.sections[0]).id; }
    openPalette(t, sid, (n.items[sid] || []).length);
    return;
  }
  if (e.key === '?') { useApp.setState({ modal: { kind: 'keys' } }); }
}
