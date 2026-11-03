/** Vista principal: barra, índice, hoja y espejo del texto final. */
import { memo, useEffect, useRef, useState } from 'react';
import { secOn } from '../engine/text';
import type { Template } from '../engine/types';
import { choiceCount, emptyOne, pendingOne } from '../state/noteOps';
import {
  allBlocks, copyNote, currentTpl, markAllNormal, newNote, newPatient, noteOf, noteParts, noteText, pendingCount,
  redo, setView, undo, updateSettings, useApp, visOf,
} from '../state/store';
import { deleteCustom, openEditorFor, saveAsCombo } from './actions';
import { goNextPending } from './keyboard';
import { TemplateBody } from './Sheet';

const mirrorDefault = () => window.innerWidth > 1100;
const isTouch = () => window.matchMedia?.('(hover: none)').matches;

function Menu({ label, right, children, ic, title }: { label: React.ReactNode; right?: boolean; ic?: boolean; title?: string; children: React.ReactNode }) {
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
      <button className={`btn${ic ? ' ic' : ''}`} aria-haspopup="true" aria-expanded={open} aria-label={title} title={title} onClick={() => setOpen(!open)}>{label}</button>
      <span className={`menu${right ? ' right' : ''}${open ? ' open' : ''}`} role="menu" onClick={() => setOpen(false)}>{children}</span>
    </span>
  );
}
const Check = () => <span className="ck" aria-hidden="true">✓</span>;
const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

/** Progreso: se calcula solo cuando cambian las notas. */
function useProgress(t: Template) {
  useApp((s) => s.notes);
  useApp((s) => s.settings.vis);
  const blocks = allBlocks(t);
  const p = pendingCount(t);
  const tot = blocks.reduce((a, b) => a + choiceCount(b, noteOf(b), visOf(b)), 0);
  const empty = blocks.reduce((a, b) => a + emptyOne(b, noteOf(b), visOf(b)), 0);
  return { p, empty, pc: tot ? Math.round(((tot - p) / tot) * 100) : 100 };
}

const Progress = memo(function Progress({ t }: { t: Template }) {
  const { p, empty, pc } = useProgress(t);
  return (
    <button className={`prog${p ? '' : ' done'}`} onClick={() => goNextPending(1)}
      title={(p ? `Faltan ${p} ${p === 1 ? 'opción' : 'opciones'}. Toca para ir a la siguiente (Tab).` : 'Todas las opciones elegidas.') + (empty ? ` ${empty} ${empty === 1 ? 'campo vacío no saldrá' : 'campos vacíos no saldrán'}.` : '')}>
      <span className="prog-bar"><i style={{ width: pc + '%' }} /></span>
      <span className="pending">{p ? `Faltan ${p}` : 'Completa'}</span>
    </button>
  );
});

/** Se actualiza con una pausa corta: lo pesado no se recalcula en cada tecla. */
function useCalm(ms = 180) {
  const [, setV] = useState(0);
  useEffect(() => {
    let tm: ReturnType<typeof setTimeout> | undefined;
    const un = useApp.subscribe((s, p) => {
      if (s.notes === p.notes && s.settings.vis === p.settings.vis && s.tplId === p.tplId) return;
      clearTimeout(tm);
      tm = setTimeout(() => setV((x) => x + 1), ms);
    });
    return () => { clearTimeout(tm); un(); };
  }, [ms]);
}

const Index = memo(function Index({ t }: { t: Template }) {
  useCalm();
  const vis = useApp((s) => s.settings.vis[t.baseId || t.id]);
  const n = noteOf(t);
  const chips: React.ReactNode[] = [];
  for (const s of t.sections) {
    if (!secOn(vis, s)) continue;
    const p = pendingOne({ ...t, sections: [s] }, n, vis);
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
});

const MirrorPane = memo(function MirrorPane({ t }: { t: Template }) {
  useCalm(150);
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
});

function UndoRedo() {
  const u = useApp((s) => s.hist.u.length > 0);
  const r = useApp((s) => s.hist.r.length > 0);
  return (<>
    <button className="btn ic" title="Deshacer (Ctrl+Z)" aria-label="Deshacer" disabled={!u} onClick={undo}>↶</button>
    <button className="btn ic" title="Rehacer (Ctrl+Shift+Z)" aria-label="Rehacer" disabled={!r} onClick={redo}>↷</button>
  </>);
}

/** Aviso cuando la nota abierta tiene datos de hace rato: puede ser de otro paciente. */
function StaleBanner() {
  const started = useApp((s) => s.started);
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((x) => x + 1), 60000); return () => clearInterval(id); }, []);
  if (!started) return null;
  const mins = Math.round((Date.now() - started) / 60000);
  if (mins < 45) return null;
  return (
    <div className="stale" role="status">
      Esta nota tiene datos desde las <b>{hhmm(started)}</b> (hace {mins < 120 ? `${mins} min` : `${Math.round(mins / 60)} h`}). Si es otro paciente, empieza de cero.
      <button className="btn sm" onClick={() => newPatient()}>Paciente nuevo</button>
    </div>
  );
}

export function NoteView() {
  const settings = useApp((s) => s.settings);
  const custom = useApp((s) => s.custom);
  const started = useApp((s) => s.started);
  useApp((s) => s.tplId);
  useApp((s) => s.catalog);
  const [prev, setPrev] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const t = currentTpl();
  const hide = settings.hide !== false;
  const mirror = (settings.mirror ?? mirrorDefault()) && !prev;
  const onlyPend = !!settings.onlyPending;
  // "Todo normal" depende de qué bloques hay, no de lo escrito
  useApp((s) => s.notes[t.id]?.items);
  const hasNormal = allBlocks(t).some((b) => b.normal);

  useEffect(() => {
    document.querySelector('main')?.classList.toggle('wide', mirror);
    const h = barRef.current?.offsetHeight;
    if (h) document.documentElement.style.setProperty('--barh', h + 'px');
  });

  const sheet = (
    <div className="col">
      {!prev && <Index t={t} />}
      <StaleBanner />
      <div className={`sheet m-pick${hide ? ' hide-rej' : ''}${settings.compact ? ' compact' : ''}${onlyPend ? ' only-pend' : ''}`} id="sheet">
        {prev ? <div className="preview">{noteText(t)}</div> : <TemplateBody t={t} />}
      </div>
    </div>
  );

  return (
    <>
      <div className="bar" id="bar" ref={barRef}>
        <button className="btn mob" onClick={() => useApp.setState({ pickOpen: true })} aria-label="Abrir lista de notas">☰</button>
        <h1 title={t.name}>{t.name}</h1>
        <Progress t={t} />
        <span className="bar-gap" />
        {started && <span className="since" title="Hora en que empezaste a llenar esta nota">desde {hhmm(started)}</span>}
        <span className="desk">
          <UndoRedo />
          {hasNormal && <button className="btn" title="Marca la primera opción (normal) en todo lo que no hayas elegido" onClick={() => markAllNormal(t)}>Todo normal</button>}
          <button className={`btn${onlyPend ? ' on' : ''}`} aria-pressed={onlyPend} title="Atenúa lo que ya está completo para ver solo lo que falta" onClick={() => updateSettings((s) => { s.onlyPending = !onlyPend; })}>Pendientes</button>
        </span>
        <Menu label="⋯" right ic title="Más opciones">
          <button role="menuitem" className="mob-only" onClick={undo}>Deshacer</button>
          {hasNormal && <button role="menuitem" className="mob-only" onClick={() => markAllNormal(t)}>Todo normal</button>}
          <button role="menuitem" onClick={() => { newNote(); }}>Rehacer esta nota desde cero</button>
          <span className="menu-sep" />
          <button role="menuitemcheckbox" aria-checked={mirror} onClick={() => updateSettings((s) => { s.mirror = !mirror; })}><Check />Texto final al lado</button>
          <button role="menuitemcheckbox" aria-checked={prev} onClick={() => setPrev(!prev)}><Check />Ver solo el texto final</button>
          <button role="menuitemcheckbox" aria-checked={onlyPend} className="mob-only" onClick={() => updateSettings((s) => { s.onlyPending = !onlyPend; })}><Check />Solo pendientes</button>
          <button role="menuitemcheckbox" aria-checked={hide} onClick={() => updateSettings((s) => { s.hide = !hide; })}><Check />Ocultar opciones descartadas</button>
          <button role="menuitemcheckbox" aria-checked={!!settings.compact} onClick={() => updateSettings((s) => { s.compact = !s.compact; })}><Check />Letra más compacta</button>
          {([[null, 'Tema automático'], ['light', 'Tema claro'], ['dark', 'Tema oscuro']] as const).map(([v, l]) => (
            <button key={l} role="menuitemradio" aria-checked={(settings.theme ?? null) === v} onClick={() => updateSettings((s) => { s.theme = v; })}><Check />{l}</button>
          ))}
          <span className="menu-sep" />
          {t.combo
            ? <button role="menuitem" onClick={() => openEditorFor(t.combo!.base)}>Editar plantilla principal</button>
            : <button role="menuitem" onClick={() => openEditorFor(t.id)}>Editar plantilla</button>}
          {t.combo && <button role="menuitem" onClick={() => saveAsCombo(t, true)}>Actualizar nota compuesta con los bloques actuales</button>}
          <button role="menuitem" onClick={() => saveAsCombo(t, false)}>Guardar como nota compuesta</button>
          {t.combo && custom[t.id] && <button role="menuitem" onClick={() => deleteCustom(t.id)}>Eliminar nota compuesta</button>}
          <span className="menu-sep" />
          <button role="menuitem" onClick={() => setView('profile')}>Mi perfil y firma</button>
          {!isTouch() && <button role="menuitem" onClick={() => useApp.setState({ modal: { kind: 'keys' } })}>Atajos de teclado <kbd>?</kbd></button>}
          <button role="menuitem" onClick={() => setView('about')}>Respaldo y versiones</button>
        </Menu>
        <button className="btn desk" title="Borra todas las notas abiertas para empezar con el siguiente paciente (Alt+P)" onClick={() => newPatient()}>Paciente nuevo</button>
        <button className="btn primary desk" title="Copiar (Ctrl+Enter)" onClick={() => copyNote()}>Copiar nota</button>
      </div>
      {mirror ? <div className="split">{sheet}<MirrorPane t={t} /></div> : sheet}
      <nav className="botbar" aria-label="Acciones">
        <button onClick={() => goNextPending(1)}><b>↓</b>Siguiente</button>
        <button onClick={() => setPrev(!prev)} aria-pressed={prev}><b>¶</b>{prev ? 'Editar' : 'Ver nota'}</button>
        <button onClick={() => newPatient()}><b>＋</b>Paciente</button>
        <button className="primary" onClick={() => copyNote()}><b>⧉</b>Copiar</button>
      </nav>
    </>
  );
}
