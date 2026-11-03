/**
 * Hoja de la nota: secciones, párrafos con opciones y campos, bloques insertados.
 *
 * Rendimiento: cada párrafo se suscribe solo a los valores de sus propios campos, y las notas
 * son inmutables (immer), así que escribir en un campo redibuja un párrafo y no la hoja entera.
 */
import { memo, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { cap, joinList } from '../clinical/format';
import { HEADING_RE, OPF, TOK, baseId, isChoice, isFilled, optLabel, parHidden, parts, secOn, valText } from '../engine/text';
import type { NoteState, Template, Visibility } from '../engine/types';
import {
  addOption, addText, clearValue, copyPiece, dropField, duplicateItem, insertedTpl, markAllNormal, moveItem, noteOf, noteText,
  onPatientReset, pickOption, removeItem, restorePar, setItemText, setValue, toggleItemMin, togglePar, toggleSection, useApp,
} from '../state/store';
import { Caret, EyeOffIcon, UndoIcon } from './icons';
import { LAWidget, OpioidWidget, QuestWidget } from './Widgets';

/* estado de interfaz de la hoja (no se guarda) */
export const useSheetUI = create<{ openGrp: string | null; showAlt: Record<string, boolean> }>(() => ({ openGrp: null, showAlt: {} }));
const setOpen = (g: string | null) => useSheetUI.setState({ openGrp: g });
onPatientReset(() => useSheetUI.setState({ openGrp: null, showAlt: {} }));

export const openPalette = (host: Template, sid: string, idx: number) => useApp.setState({ palette: { host: host.id, sid, idx } });

type AppS = ReturnType<typeof useApp.getState>;
/** Nota de una plantilla dentro de un selector (las notas sin tocar vienen de un caché estable). */
const sel = (s: AppS, t: Template): NoteState => s.notes[t.id] || noteOf(t);

/* ---------------- texto con negritas que pueden abarcar campos ---------------- */

/** Divide un texto literal por ** y alterna la negrita; devuelve el estado final. */
function boldText(s: string, bold: boolean, out: ReactNode[], key: string): boolean {
  const segs = s.split('**');
  segs.forEach((x, i) => {
    if (i > 0) bold = !bold;
    if (x) out.push(bold ? <strong key={key + i}>{x}</strong> : x);
  });
  return bold;
}

/* ---------------- campos ---------------- */

function Field({ t, k, inOpt }: { t: Template; k: string; inOpt?: boolean }) {
  const d = t.vars[k];
  const v = (noteOf(t).values[k] as string) || '';
  if (!d) return null;
  return (
    <input
      className={`fld${inOpt ? ' optfld' : ''}`}
      data-key={k}
      data-tid={t.id}
      placeholder={d.label}
      aria-label={d.label}
      autoComplete="off"
      value={v}
      size={Math.max(v.length, d.label.length, 3)}
      onChange={(e) => setValue(t, k, e.target.value)}
    />
  );
}

/** Campos dentro de la opción elegida, con el texto que los rodea. */
function OptFieldsInline({ t, v }: { t: Template; v: string }) {
  if (v.indexOf('⟦') < 0) return null;
  const P = v.split(/⟦(\w+)⟧/);
  const out: ReactNode[] = [];
  for (let i = 1; i < P.length; i += 2) {
    out.push(' ', <Field key={P[i]} t={t} k={P[i]} inOpt />);
    const tail = P[i + 1];
    if (tail && tail.trim()) out.push(<span key={'t' + i} className="optt">{tail}</span>);
  }
  return <>{out}</>;
}
function OptFields({ t, v }: { t: Template; v: string }) {
  if (!v || v.indexOf('⟦') < 0) return null;
  return <>{[...v.matchAll(OPF)].map((m) => <span key={m[1]}> <Field t={t} k={m[1]} inOpt /></span>)}</>;
}

/* ---------------- grupos de opciones ---------------- */

function AddOption({ t, k, inMenu }: { t: Template; k: string; inMenu?: boolean }) {
  const [on, setOn] = useState(false);
  const [val, setVal] = useState('');
  if (!on) {
    return (
      <button className="add" role={inMenu ? 'menuitem' : undefined} title="Escribir otra opción solo para esta nota" aria-label="Escribir otra opción" onClick={() => setOn(true)}>
        {inMenu ? '+ otra opción' : '+'}
      </button>
    );
  }
  const commit = () => { if (val.trim()) addOption(t, k, val.trim()); setOn(false); setVal(''); };
  return (
    <input className="cust-in" autoFocus placeholder="otra opción…" value={val} onChange={(e) => setVal(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') { setOn(false); setVal(''); } }} />
  );
}

/** Grupos largos: una pastilla con lo elegido y un menú. */
const isCompact = (opts: { v: string }[]) => opts.length > 5 || opts.reduce((s, o) => s + o.v.length, 0) > 110;

function Group({ t, k, c, dropKey }: { t: Template; k: string; c: boolean; dropKey?: [string, number] }) {
  const n = noteOf(t), d = t.vars[k], val = n.values[k];
  const gid = t.id + '|' + k;
  const open = useSheetUI((s) => s.openGrp === gid);
  const menuOpen = useSheetUI((s) => s.openGrp === gid + '|menu');
  const sa = useSheetUI((s) => !!s.showAlt[gid]);
  const opts = [...(d.options || []), ...(n.custom[k] || []).map((v) => ({ v, cust: true, warn: false, ex: false, hint: undefined }))];
  const isSel = (v: string) => (d.kind === 'multi' ? ((val as string[]) || []).includes(v) : val === v);
  const filled = isFilled(d, val);

  if (isCompact(opts)) {
    const sv = filled ? (d.list ? joinList((val as string[]) || [], t.lang) : valText(t, n, k, val)) : d.label;
    return (
      <span className={`grp cmp${filled ? ' chosen' : ''}${d.kind === 'multi' ? ' multi' : ''}${open ? ' open' : ''}`} tabIndex={-1} data-gk={k} data-tid={t.id} aria-label={d.label}>
        <button className="cpt" aria-expanded={open} title={`${filled ? 'Cambiar' : 'Elegir'}: ${d.label}`} onClick={() => setOpen(open ? null : gid)}>
          {c ? cap(sv) : sv}<span className="car" aria-hidden="true"><Caret /></span>
        </button>
        {open && (
          <span className="pop" role="listbox" aria-label={d.label}>
            <span className="pop-t">{d.label}{d.kind === 'multi' ? ' · puedes elegir varias' : ''}</span>
            {opts.map((o, i) => (
              <button key={o.v} className={`opt${isSel(o.v) ? ' sel' : ''}${o.warn ? ' warn' : ''}${'cust' in o ? ' cust' : ''}`} data-n={i < 9 ? i + 1 : undefined}
                role="option" aria-selected={isSel(o.v)}
                onClick={() => { pickOption(t, k, o.v); if (d.kind !== 'multi') setOpen(null); }}>
                {optLabel(o.v)}
              </button>
            ))}
            <span className="pop-f">
              <AddOption t={t} k={k} inMenu />
              {filled && <button className="drop" onClick={() => { clearValue(t, k); }}>Borrar elección</button>}
              {dropKey && <button className="drop" onClick={() => { setOpen(null); dropField(t, dropKey[0], dropKey[1]); }}>Quitar de la nota</button>}
              <button className="pop-ok" onClick={() => setOpen(null)}>{d.kind === 'multi' ? 'Listo' : 'Cerrar'}</button>
            </span>
          </span>
        )}
        {(d.kind === 'multi' ? ((val as string[]) || []) : [val as string]).map((x, i) => x ? <OptFields key={i} t={t} v={x} /> : null)}
      </span>
    );
  }

  const label = (v: string) => {
    const s = isSel(v) && v.indexOf('⟦') >= 0 ? v.split(/⟦\w+⟧/)[0].trim() : optLabel(v);
    return c ? cap(s) : s;
  };
  return (
    <span className={`grp${filled ? ' chosen' : ''}${sa ? ' showalt' : ''}${d.kind === 'multi' ? ' multi' : ''}`} tabIndex={-1} data-gk={k} data-tid={t.id} aria-label={d.label}>
      <span className="br">[</span>
      {opts.map((o, i) => (
        <span key={o.v}>
          {i > 0 && <span className="sep"> / </span>}
          <button className={`opt${isSel(o.v) ? ' sel' : ''}${o.warn ? ' warn' : ''}${'cust' in o ? ' cust' : ''}${o.ex ? ' ex' : ''}`} data-n={i < 9 ? i + 1 : undefined}
            aria-pressed={isSel(o.v)}
            onClick={() => { if (sa) useSheetUI.setState((s) => ({ showAlt: { ...s.showAlt, [gid]: false } })); pickOption(t, k, o.v); }}>
            {label(o.v)}
          </button>
          {isSel(o.v) && <OptFieldsInline t={t} v={o.v} />}
        </span>
      ))}
      <span className="br">]</span>
      <span className="gmenu">
        <button className="gm-btn" aria-haspopup="menu" aria-expanded={menuOpen} title="Más acciones de este campo" aria-label={`Más acciones: ${d.label}`}
          onClick={() => setOpen(menuOpen ? null : gid + '|menu')}>⋯</button>
        {menuOpen && (
          <span className="gm-pop" role="menu">
            {filled && <button role="menuitem" onClick={() => { useSheetUI.setState((s) => ({ showAlt: { ...s.showAlt, [gid]: !sa } })); setOpen(null); }}>{sa ? 'Ocultar las otras opciones' : 'Ver las otras opciones'}</button>}
            {filled && <button role="menuitem" onClick={() => { clearValue(t, k); setOpen(null); }}>Borrar elección</button>}
            <AddOption t={t} k={k} inMenu />
            {dropKey && <button role="menuitem" onClick={() => { setOpen(null); dropField(t, dropKey[0], dropKey[1]); }}>Quitar de la nota</button>}
          </span>
        )}
      </span>
    </span>
  );
}

/* ---------------- tokens y párrafos ---------------- */

function Mirror({ t, k, c }: { t: Template; k: string; c: boolean }) {
  const n = noteOf(t), d = t.vars[k], v = n.values[k], f = isFilled(d, v);
  const tx = f ? valText(t, n, k, v) : d.label;
  return <span className={`mirror${f ? '' : ' empty'}`}>{f && c ? cap(tx) : tx}</span>;
}

function Tok({ t, k, c, mirror, dropKey }: { t: Template; k: string; c: boolean; mirror: boolean; dropKey: [string, number] }) {
  const d = t.vars[k];
  if (!d) return null;
  if (mirror) return <Mirror t={t} k={k} c={c} />;
  const drop = <button className="drop" title="Quitar este campo de esta nota" aria-label="Quitar este campo" onClick={() => dropField(t, dropKey[0], dropKey[1])}>×</button>;
  switch (d.kind) {
    case 'opioid': return <span className="tok"><OpioidWidget t={t} k={k} />{drop}</span>;
    case 'la': return <span className="tok"><LAWidget t={t} k={k} />{drop}</span>;
    case 'quest': return <span className="tok"><QuestWidget t={t} k={k} qid={d.qid!} />{drop}</span>;
    case 'text': return <span className="tok"><span className="fwrap"><Field t={t} k={k} />{drop}</span></span>;
    default: return <span className="tok"><Group t={t} k={k} c={c} dropKey={dropKey} /></span>;
  }
}

/** Claves cuyo valor afecta al párrafo: sus campos y los campos dentro de sus opciones. */
function paraKeys(t: Template, b: string): string[] {
  const ks = new Set<string>();
  for (const x of parts(b).toks) {
    ks.add(x.k);
    for (const o of t.vars[x.k]?.options || []) for (const m of o.v.matchAll(OPF)) ks.add(m[1]);
  }
  return [...ks];
}

interface ParProps { t: Template; sid: string; i: number; b: string; mirrors: boolean[] }

const Paragraph = memo(function Paragraph({ t, sid, i, b, mirrors }: ParProps) {
  const pk = sid + ':' + i;
  const keys = useMemo(() => paraKeys(t, b), [t, b]);
  // se vuelve a dibujar solo si cambian sus valores, sus opciones propias o sus campos quitados
  useApp(useShallow((s) => { const n = sel(s, t); return [...keys.map((k) => n.values[k]), ...keys.map((k) => n.custom[k]), n.drop[pk], n.lit[pk]]; }));
  const n = noteOf(t), p = parts(b), Ls = n.lit[pk] || p.lits, dr = n.drop[pk] || {};
  const out: ReactNode[] = [];
  let bold = false, pending = false;
  for (let j = 0; j < Ls.length; j++) {
    bold = boldText(Ls[j], bold, out, 'l' + j + '-');
    if (j < p.toks.length && !dr[j]) {
      const tk = p.toks[j], d = t.vars[tk.k];
      if (d && isChoice(d) && !mirrors[j] && !isFilled(d, n.values[tk.k])) pending = true;
      const el = <Tok key={'t' + j} t={t} k={tk.k} c={tk.c} mirror={mirrors[j]} dropKey={[pk, j]} />;
      out.push(bold ? <strong key={'b' + j}>{el}</strong> : el);
    }
  }
  const mod = !!n.lit[pk] || Object.keys(dr).length > 0;
  const head = HEADING_RE.test(b.trim());
  return (
    <div className={`par${mod ? ' mod' : ''}${head ? ' hd' : ''}${pending ? ' pend' : ' done'}`} data-pk={pk}>
      <p>{out}</p>
      <div className="par-tools">
        <button className="par-x rst" title="Volver al texto original de este párrafo" aria-label="Volver al texto original" onClick={() => restorePar(t, pk)}><UndoIcon /></button>
        <button className="par-x" title="Ocultar este párrafo" aria-label="Ocultar este párrafo" onClick={() => togglePar(t, pk)}><EyeOffIcon /></button>
      </div>
    </div>
  );
});

/** Para cada párrafo, qué tokens repiten un campo ya mostrado antes (se ven como espejo). */
function mirrorMap(t: Template, vis: Visibility | undefined, drop: NoteState['drop']): Record<string, boolean[]> {
  const seen = new Set<string>(), out: Record<string, boolean[]> = {};
  for (const s of t.sections) {
    if (!secOn(vis, s)) continue;
    s.blocks.forEach((b, i) => {
      if (parHidden(vis, s.id, i)) return;
      const pk = s.id + ':' + i, dr = drop[pk] || {};
      out[pk] = parts(b).toks.map((x, j) => {
        if (dr[j]) return false;
        if (seen.has(x.k)) return true;
        seen.add(x.k);
        return false;
      });
    });
  }
  return out;
}

/** Opciones sin elegir en una sección (para el botón Normal y el modo "solo pendientes"). */
function sectionPending(t: Template, n: NoteState, vis: Visibility | undefined, sid: string): number {
  const s = t.sections.find((x) => x.id === sid);
  if (!s || !secOn(vis, s)) return 0;
  const seen = new Set<string>();
  let p = 0;
  s.blocks.forEach((b, i) => {
    if (parHidden(vis, sid, i)) return;
    const dr = n.drop[sid + ':' + i] || {};
    parts(b).toks.forEach((x, j) => {
      const d = t.vars[x.k];
      if (dr[j] || seen.has(x.k) || !isChoice(d) || isFilled(d, n.values[x.k])) return;
      seen.add(x.k);
      p++;
    });
  });
  return p;
}

/* ---------------- textos y bloques insertados ---------------- */

function TextItem({ host, sid, i, id, v }: { host: Template; sid: string; i: number; id: string; v: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }, [v]);
  return (
    <div className="par item txt">
      <textarea ref={ref} className="xtra" rows={1} value={v} placeholder="Escribe aquí…" autoFocus={!v} onChange={(e) => setItemText(host, sid, id, e.target.value)} />
      <div className="it-tools">
        <button className="btn ic sm" title="Subir" aria-label="Subir" onClick={() => moveItem(host, sid, i, -1)}>↑</button>
        <button className="btn ic sm" title="Bajar" aria-label="Bajar" onClick={() => moveItem(host, sid, i, 1)}>↓</button>
        <button className="btn ic sm" title="Quitar este texto" aria-label="Quitar este texto" onClick={() => removeItem(host, sid, i)}>×</button>
      </div>
    </div>
  );
}

function MiniPreview({ v, onOpen }: { v: Template; onOpen: () => void }) {
  useApp((s) => s.notes[v.id]);
  const pv = noteText(v).replace(/\s+/g, ' ').trim();
  return <button className="mini-prev" title="Expandir para editar" onClick={onOpen}>{pv ? (pv.length > 220 ? pv.slice(0, 217) + '…' : pv) : <i>Sin contenido todavía</i>}</button>;
}

function InsertedBlock({ host, sid, i, u, base, min }: { host: Template; sid: string; i: number; u: string; base: string; min?: boolean }) {
  const v = insertedTpl(u, base);
  const pend = useApp((s) => (v ? countPending(v, s) : 0));
  if (!v) return <div className="ins item"><div className="ins-head"><span className="ins-title">Bloque no disponible ({base})</span><button className="btn sm" onClick={() => removeItem(host, sid, i)}>Quitar</button></div></div>;
  return (
    <div className={`ins item${min ? ' mini' : ''}`} data-tid={v.id} id={'blk-' + v.id}>
      <div className="ins-head">
        <button className="btn ic sm mintog" aria-expanded={!min} title={min ? 'Expandir para editar' : 'Minimizar: sigue en la nota, pero ocupa menos espacio'} onClick={() => toggleItemMin(host, sid, i)}>{min ? '▸' : '▾'}</button>
        <span className="ins-title">{v.name}</span>
        <span className={`ins-pend${pend ? '' : ' ok'}`}>{pend ? `Faltan ${pend}` : '✓'}</span>
        {!min && (<>
          {v.normal && pend > 0 && <button className="btn sm" onClick={() => markAllNormal(v)}>Todo normal</button>}
          <button className="btn ic sm" title="Subir" aria-label="Subir" onClick={() => moveItem(host, sid, i, -1)}>↑</button>
          <button className="btn ic sm" title="Bajar" aria-label="Bajar" onClick={() => moveItem(host, sid, i, 1)}>↓</button>
          <button className="btn sm" title="Copiar solo este bloque" onClick={() => copyPiece(v)}>Copiar</button>
          <button className="btn sm" title="Insertar una copia exacta debajo" onClick={() => duplicateItem(host, sid, i)}>Duplicar</button>
          <button className="btn sm" onClick={() => removeItem(host, sid, i)}>Quitar</button>
        </>)}
      </div>
      {min ? <MiniPreview v={v} onOpen={() => toggleItemMin(host, sid, i)} /> : <TemplateBody t={v} />}
    </div>
  );
}

function countPending(t: Template, s: AppS): number {
  const n = sel(s, t), vis = s.settings.vis[baseId(t)];
  return t.sections.reduce((a, x) => a + sectionPending(t, n, vis, x.id), 0);
}

/* ---------------- secciones ---------------- */

function Section({ t, sid, mirrors }: { t: Template; sid: string; mirrors: Record<string, boolean[]> }) {
  const s = t.sections.find((x) => x.id === sid)!;
  const vis = useApp((st) => st.settings.vis[baseId(t)]);
  const items = useApp((st) => sel(st, t).items[sid]);
  const pend = useApp((st) => sectionPending(t, sel(st, t), st.settings.vis[baseId(t)], sid));
  const on = secOn(vis, s);
  const L = (items || []).filter((x) => x.k === 'x' || !t.virtual);
  const host = !t.virtual;
  const choices = s.blocks.some((b) => parts(b).toks.some((x) => isChoice(t.vars[x.k])));
  const pt = (i: number) => host ? (
    <div className="inspt" key={'pt' + i}><button title="Insertar aquí un bloque o texto" aria-label="Insertar aquí" onClick={() => openPalette(t, sid, i)}>+</button></div>
  ) : null;
  return (
    <section className={`sec${on ? '' : ' off'}${on && choices && !pend ? ' sdone' : ''}`} data-sid={sid} id={`sec-${t.id}-${sid}`}>
      <div className="sec-head">
        <span className="sec-title">{s.title}</span>
        {on && choices && <span className={`sec-pend${pend ? '' : ' ok'}`}>{pend ? pend : '✓'}</span>}
        <span className="rule" />
        {on && t.normal && pend > 0 && <button className="toggle nrm" title="Marca la primera opción (normal) en lo pendiente de esta sección" onClick={() => markAllNormal(t, sid)}>Normal</button>}
        {on && <button className="toggle cpy" title={`Copiar solo «${s.title}», para pegarla en su campo de la historia clínica`} onClick={() => copyPiece(t, sid)}>Copiar</button>}
        <button className="toggle" onClick={() => toggleSection(t, sid, !on)}>{on ? 'Ocultar' : 'Mostrar'}</button>
      </div>
      {on && (<>
        {s.blocks.map((b, i) => parHidden(vis, sid, i)
          ? (
            <div className="par-off" key={sid + ':' + i}>
              <span className="peek">{b.replace(TOK, '…').replace(/\*\*/g, '')}</span>
              <button onClick={() => togglePar(t, sid + ':' + i)}>Mostrar</button>
            </div>
          )
          : <Paragraph key={sid + ':' + i} t={t} sid={sid} i={i} b={b} mirrors={mirrors[sid + ':' + i] || []} />)}
        {L.length > 0 && pt(0)}
        {L.map((it, i) => (
          <div key={it.k === 'x' ? it.id : it.uid}>
            {it.k === 'x'
              ? <TextItem host={t} sid={sid} i={i} id={it.id} v={it.v} />
              : <InsertedBlock host={t} sid={sid} i={i} u={it.uid} base={it.base} min={it.min} />}
            {i < L.length - 1 && pt(i + 1)}
          </div>
        ))}
        <div className="sec-add">
          <button className="addtxt" onClick={() => addText(t, sid, null)}>+ Agregar texto</button>
          {host && <button className="addtxt addblk" onClick={() => openPalette(t, sid, L.length)}>+ Insertar bloque</button>}
        </div>
      </>)}
    </section>
  );
}

/* ---------------- cuerpo de una plantilla ---------------- */

export const TemplateBody = memo(function TemplateBody({ t }: { t: Template }) {
  const vis = useApp((s) => s.settings.vis[baseId(t)]);
  const drop = useApp((s) => sel(s, t).drop);
  const mirrors = useMemo(() => mirrorMap(t, vis, drop), [t, vis, drop]);
  return (
    <div data-tid={t.id}>
      {t.sections.map((s) => <Section key={s.id} t={t} sid={s.id} mirrors={mirrors} />)}
    </div>
  );
});
