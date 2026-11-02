/** Vista principal: barra, índice, hoja y espejo del texto final. */
import { useEffect, useRef, useState } from 'react';
import { emptyOne, choiceCount } from '../state/noteOps';
import {
  allBlocks, copyNote, currentTpl, markAllNormal, newNote, noteOf, noteParts, noteText, pendingCount,
  redo, undo, updateSettings, useApp, visOf, setView, toast,
} from '../state/store';
import { secOn } from '../engine/text';
import type { Template } from '../engine/types';
import { pendingOne } from '../state/noteOps';
import { TemplateBody } from './Sheet';
import { goNextPending } from './keyboard';
import { deleteCustom, openEditorFor, saveAsCombo } from './actions';

const mirrorDefault = () => window.innerWidth > 1100;

function Menu({ label, right, children, ic }: { label: string; right?: boolean; ic?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [open]);
  return (
    <span className="menu-w" ref={ref}>
      <button className={`btn${ic ? ' ic' : ''}`} aria-haspopup="true" aria-expanded={open} aria-label={ic ? 'Más opciones' : undefined} onClick={() => setOpen(!open)}>{label}</button>
      <span className={`menu${right ? ' right' : ''}${open ? ' open' : ''}`} role="menu" onClick={() => setOpen(false)}>{children}</span>
    </span>
  );
}
const Check = () => <span className="ck" aria-hidden="true">✓</span>;

function secPending(t: Template, sid: string): number {
  const s = t.sections.find((x) => x.id === sid);
  if (!s) return 0;
  const one: Template = { ...t, sections: [s] };
  return pendingOne(one, noteOf(t), visOf(t));
}

function Index({ t }: { t: Template }) {
  const n = noteOf(t), vis = visOf(t);
  const chips: React.ReactNode[] = [];
  for (const s of t.sections) {
    if (!secOn(vis, s)) continue;
    const p = secPending(t, s.id);
    chips.push(
      <button key={s.id} className={`ix${p ? '' : ' ok'}`} onClick={() => document.getElementById(`sec-${t.id}-${s.id}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>
        {s.title}{p ? <b>{p}</b> : <i>✓</i>}
      </button>,
    );
    for (const it of n.items[s.id] || []) {
      if (it.k !== 'b') continue;
      const v = allBlocks(t).find((b) => b.id === 'ins_' + it.uid);
      if (!v) continue;
      const q = pendingCount(v);
      chips.push(
        <button key={it.uid} className={`ix sub${q ? '' : ' ok'}`} onClick={() => document.getElementById('blk-' + v.id)?.scrollIntoView({ block: 'start', behavior: 'smooth' })}>
          {v.name}{q ? <b>{q}</b> : <i>✓</i>}
        </button>,
      );
    }
  }
  return chips.length > 1 ? <nav className="idx" aria-label="Secciones de la nota">{chips}</nav> : null;
}

function MirrorPane({ t }: { t: Template }) {
  const P = noteParts(t);
  const goto = (tid: string, pk: string) => {
    const box = document.querySelector(`[data-tid="${tid}"]`);
    const el = pk.startsWith('x:') ? box?.querySelector('.xtra') : box?.querySelector(`[data-pk="${pk}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.classList.remove('spot'); void (el as HTMLElement).offsetWidth; el.classList.add('spot');
  };
  return (
    <div className="mirror-pane" aria-live="off">
      <div className="mirror-head"><span>Así va quedando la nota</span><button className="btn sm" onClick={() => copyNote()}>Copiar</button></div>
      <div className="mirror-txt">
        {P.length ? P.map((p, i) => (
          <p key={p.tid + p.pk + i} className={`mp${p.head ? ' mh' : ''}`} title="Ir a este párrafo" onClick={() => goto(p.tid, p.pk)}>
            {p.txt.split(/(\[[^[\]\n]+\])/).map((x, j) => (j % 2 ? <span key={j} className="gap">{x}</span> : x))}
          </p>
        )) : <span className="muted">La nota aparecerá aquí.</span>}
      </div>
    </div>
  );
}

export function NoteView() {
  useApp((s) => s.notes);
  const settings = useApp((s) => s.settings);
  const hist = useApp((s) => s.hist);
  const custom = useApp((s) => s.custom);
  useApp((s) => s.tplId);
  useApp((s) => s.catalog);
  const [prev, setPrev] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const t = currentTpl();
  const hide = settings.hide !== false;
  const mirror = (settings.mirror ?? mirrorDefault()) && !prev;
  const blocks = allBlocks(t);
  const hasNormal = blocks.some((b) => b.normal);
  const p = pendingCount(t);
  const tot = blocks.reduce((a, b) => a + choiceCount(b, noteOf(b), visOf(b)), 0);
  const empty = blocks.reduce((a, b) => a + emptyOne(b, noteOf(b), visOf(b)), 0);
  const pc = tot ? Math.round(((tot - p) / tot) * 100) : 100;

  useEffect(() => {
    document.querySelector('main')?.classList.toggle('wide', mirror);
    const h = barRef.current?.offsetHeight;
    if (h) document.documentElement.style.setProperty('--barh', h + 'px');
  });

  const sheet = (
    <div className="col">
      {!prev && <Index t={t} />}
      <div className={`sheet m-pick${hide ? ' hide-rej' : ''}${settings.compact ? ' compact' : ''}`} id="sheet">
        {prev ? <div className="preview">{noteText(t)}</div> : <TemplateBody t={t} />}
      </div>
    </div>
  );

  return (
    <>
      <div className="bar" id="bar" ref={barRef}>
        <button className="btn mob" onClick={() => useApp.setState({ pickOpen: true })}>Notas</button>
        <h1>{t.name}</h1>
        <button className={`prog${p ? '' : ' done'}`} title={(p ? `Faltan ${p} ${p === 1 ? 'opción' : 'opciones'}. Toca para ir a la siguiente.` : 'Todas las opciones elegidas.') + (empty ? ` ${empty} ${empty === 1 ? 'campo vacío no saldrá' : 'campos vacíos no saldrán'}.` : '')}
          onClick={() => goNextPending(1)}>
          <span className="prog-bar"><i style={{ width: pc + '%' }} /></span>
          <span className="pending">{p ? `Faltan ${p}` : 'Completa'}</span>
        </button>
        <span className="bar-gap" />
        <button className="btn ic" title="Deshacer (Ctrl+Z)" aria-label="Deshacer" disabled={!hist.u.length} onClick={undo}>↶</button>
        <button className="btn ic" title="Rehacer (Ctrl+Shift+Z)" aria-label="Rehacer" disabled={!hist.r.length} onClick={redo}>↷</button>
        <Menu label="Vista ▾">
          <button role="menuitemcheckbox" aria-checked={mirror} onClick={() => updateSettings((s) => { s.mirror = !mirror; })}><Check />Espejo al lado</button>
          <button role="menuitemcheckbox" aria-checked={prev} onClick={() => setPrev(!prev)}><Check />Vista final</button>
          <button role="menuitemcheckbox" aria-checked={hide} onClick={() => updateSettings((s) => { s.hide = !hide; })}><Check />Ocultar descartadas</button>
          <button role="menuitemcheckbox" aria-checked={!!settings.compact} onClick={() => updateSettings((s) => { s.compact = !s.compact; })}><Check />Densidad compacta</button>
          {([[null, 'Tema automático'], ['light', 'Tema claro'], ['dark', 'Tema oscuro']] as const).map(([v, l]) => (
            <button key={l} role="menuitemradio" aria-checked={(settings.theme ?? null) === v} onClick={() => updateSettings((s) => { s.theme = v; })}><Check />{l}</button>
          ))}
        </Menu>
        <Menu label="⋯" right ic>
          {t.combo
            ? <button role="menuitem" onClick={() => openEditorFor(t.combo!.base)}>Editar plantilla principal</button>
            : <button role="menuitem" onClick={() => openEditorFor(t.id)}>Editar plantilla</button>}
          {t.combo
            ? <button role="menuitem" onClick={() => saveAsCombo(t, true)}>Actualizar nota compuesta con los bloques actuales</button>
            : null}
          <button role="menuitem" onClick={() => saveAsCombo(t, false)}>Guardar como nota compuesta</button>
          {t.combo && custom[t.id] && <button role="menuitem" onClick={() => { deleteCustom(t.id); toast('Nota compuesta eliminada'); }}>Eliminar nota compuesta</button>}
          <button role="menuitem" onClick={() => useApp.setState({ modal: { kind: 'keys' } })}>Atajos de teclado <kbd>?</kbd></button>
          <button role="menuitem" onClick={() => setView('about')}>Respaldo y versiones</button>
        </Menu>
        {hasNormal && <button className="btn" title="Marca la primera opción (normal) en todo lo que no hayas elegido" onClick={() => markAllNormal(t)}>Todo normal</button>}
        <button className="btn" onClick={() => { newNote(); toast('Nota nueva. Se conservó tu técnica habitual.'); }}>Nueva nota</button>
        <button className="btn primary" title="Copiar (Ctrl+Enter)" onClick={() => copyNote()}>Copiar nota</button>
      </div>
      {mirror ? <div className="split">{sheet}<MirrorPane t={t} /></div> : sheet}
    </>
  );
}
