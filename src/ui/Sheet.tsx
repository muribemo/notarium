/** Hoja de la nota: secciones, párrafos con opciones y campos, bloques insertados. */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { create } from 'zustand';
import { cap, joinList } from '../clinical/format';
import { HEADING_RE, OPF, TOK, isFilled, optLabel, parHidden, parts, secOn, valText } from '../engine/text';
import type { NoteState, Template } from '../engine/types';
import {
  addOption, addText, dropField, duplicateItem, insertedTpl, markAllNormal, moveItem, noteOf, noteText,
  pickOption, removeItem, restorePar, setItemText, setValue, toggleItemMin, togglePar, toggleSection, useApp, visOf,
} from '../state/store';
import { Caret, EyeOffIcon, UndoIcon } from './icons';
import { LAWidget, OpioidWidget, QuestWidget } from './Widgets';

/* estado de interfaz de la hoja (no se guarda) */
export const useSheetUI = create<{ openGrp: string | null; showAlt: Record<string, boolean> }>(() => ({ openGrp: null, showAlt: {} }));
const setOpen = (g: string | null) => useSheetUI.setState({ openGrp: g });

export const openPalette = (host: Template, sid: string, idx: number) => useApp.setState({ palette: { host: host.id, sid, idx } });

/** Negritas **…** del texto literal. */
function Piece({ s }: { s: string }) {
  const out: ReactNode[] = [];
  let last = 0, i = 0;
  for (const m of s.matchAll(/\*\*(.+?)\*\*/g)) {
    if (m.index! > last) out.push(s.slice(last, m.index));
    out.push(<strong key={i++}>{m[1]}</strong>);
    last = m.index! + m[0].length;
  }
  out.push(s.slice(last));
  return <>{out}</>;
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

function AddOption({ t, k }: { t: Template; k: string }) {
  const [on, setOn] = useState(false);
  const [val, setVal] = useState('');
  if (!on) return <button className="add" title="Escribir otra opción solo para esta nota" aria-label="Escribir otra opción" onClick={() => setOn(true)}>+</button>;
  const commit = () => { if (val.trim()) addOption(t, k, val.trim()); setOn(false); setVal(''); };
  return (
    <input className="cust-in" autoFocus placeholder="otra opción…" value={val} onChange={(e) => setVal(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } if (e.key === 'Escape') { setOn(false); setVal(''); } }} />
  );
}

function Group({ t, k, c, dropKey }: { t: Template; k: string; c: boolean; dropKey?: [string, number] }) {
  const n = noteOf(t), d = t.vars[k], val = n.values[k];
  const { openGrp, showAlt } = useSheetUI();
  const opts = [...(d.options || []), ...(n.custom[k] || []).map((v) => ({ v, cust: true, warn: false, ex: false }))];
  const isSel = (v: string) => (d.kind === 'multi' ? ((val as string[]) || []).includes(v) : val === v);
  const filled = isFilled(d, val);
  const gid = t.id + '|' + k;
  const drop = dropKey ? (
    <button className="drop" title="Quitar este campo de esta nota" aria-label="Quitar este campo" onClick={() => dropField(t, dropKey[0], dropKey[1])}>×</button>
  ) : null;
  const compact = opts.length > 5 || opts.reduce((s, o) => s + o.v.length, 0) > 110;

  if (compact) {
    const open = openGrp === gid;
    const sv = filled ? (d.list ? joinList((val as string[]) || [], t.lang) : valText(t, n, k, val)) : d.label;
    return (
      <span className={`grp cmp${filled ? ' chosen' : ''}${d.kind === 'multi' ? ' multi' : ''}${open ? ' open' : ''}`} tabIndex={-1} data-gk={k} data-tid={t.id} aria-label={d.label}>
        <button className="cpt" aria-expanded={open} title={`${filled ? 'Cambiar' : 'Elegir'}: ${d.label}`} onClick={() => setOpen(open ? null : gid)}>
          {c ? cap(sv) : sv}<span className="car" aria-hidden="true"><Caret /></span>
        </button>
        <span className="pop" role="listbox">
          {opts.map((o, i) => (
            <button key={o.v} className={`opt${isSel(o.v) ? ' sel' : ''}${o.warn ? ' warn' : ''}${'cust' in o ? ' cust' : ''}`} data-n={i < 9 ? i + 1 : undefined}
              onClick={() => { pickOption(t, k, o.v); if (d.kind !== 'multi') setOpen(null); }}>
              {optLabel(o.v)}
            </button>
          ))}
          <span className="pop-f">
            <AddOption t={t} k={k} />
            {dropKey && <button className="drop" onClick={() => dropField(t, dropKey[0], dropKey[1])}>Quitar campo</button>}
            {d.kind === 'multi' && <button className="pop-ok" onClick={() => setOpen(null)}>Listo</button>}
          </span>
        </span>
        {(d.kind === 'multi' ? ((val as string[]) || []) : [val as string]).map((x, i) => x ? <OptFields key={i} t={t} v={x} /> : null)}
      </span>
    );
  }

  const sa = !!showAlt[gid];
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
            onClick={() => { useSheetUI.setState({ showAlt: { ...showAlt, [gid]: false } }); pickOption(t, k, o.v); }}>
            {label(o.v)}
          </button>
          {isSel(o.v) && <OptFieldsInline t={t} v={o.v} />}
        </span>
      ))}
      <span className="br">]</span>
      <button className="alt" title="Ver las otras opciones" aria-label="Ver las otras opciones" onClick={() => useSheetUI.setState({ showAlt: { ...showAlt, [gid]: !sa } })}>⇄</button>
      <AddOption t={t} k={k} />
      {drop}
    </span>
  );
}

/* ---------------- tokens y párrafos ---------------- */

function Mirror({ t, n, k, c }: { t: Template; n: NoteState; k: string; c: boolean }) {
  const d = t.vars[k], v = n.values[k], f = isFilled(d, v);
  const tx = f ? valText(t, n, k, v) : d.label;
  return <span className={`mirror${f ? '' : ' empty'}`}>{f && c ? cap(tx) : tx}</span>;
}

/** Dibuja un token. `seen` controla que la segunda aparición de un campo sea un espejo. */
function renderTok(t: Template, n: NoteState, tk: { k: string; c: boolean }, seen: Set<string>, dropKey: [string, number], key: string): ReactNode {
  const d = t.vars[tk.k];
  if (!d) return null;
  if (seen.has(tk.k)) return <Mirror key={key} t={t} n={n} k={tk.k} c={tk.c} />;
  seen.add(tk.k);
  const drop = <button className="drop" title="Quitar este campo de esta nota" aria-label="Quitar este campo" onClick={() => dropField(t, dropKey[0], dropKey[1])}>×</button>;
  switch (d.kind) {
    case 'opioid': return <span key={key} className="tok"><OpioidWidget t={t} k={tk.k} />{drop}</span>;
    case 'la': return <span key={key} className="tok"><LAWidget t={t} k={tk.k} />{drop}</span>;
    case 'quest': return <span key={key} className="tok"><QuestWidget t={t} k={tk.k} qid={d.qid!} />{drop}</span>;
    case 'text': return <span key={key} className="tok"><span className="fwrap"><Field t={t} k={tk.k} />{drop}</span></span>;
    default: return <span key={key} className="tok"><Group t={t} k={tk.k} c={tk.c} dropKey={dropKey} /></span>;
  }
}

function paragraph(t: Template, n: NoteState, sid: string, i: number, b: string, seen: Set<string>): ReactNode {
  const pk = sid + ':' + i, p = parts(b), Ls = n.lit[pk] || p.lits, dr = n.drop[pk] || {};
  const out: ReactNode[] = [];
  for (let j = 0; j < Ls.length; j++) {
    out.push(<Piece key={'l' + j} s={Ls[j]} />);
    if (j < p.toks.length && !dr[j]) out.push(renderTok(t, n, p.toks[j], seen, [pk, j], 't' + j));
  }
  const mod = !!n.lit[pk] || Object.keys(dr).length > 0;
  return (
    <div key={pk} className={`par${mod ? ' mod' : ''}${HEADING_RE.test(b.trim()) ? ' hd' : ''}`} data-pk={pk}>
      <p>{out}</p>
      <div className="par-tools">
        <button className="par-x rst" title="Volver al texto original de este párrafo" aria-label="Volver al texto original" onClick={() => restorePar(t, pk)}><UndoIcon /></button>
        <button className="par-x" data-par={pk} title="Ocultar este párrafo" aria-label="Ocultar este párrafo" onClick={() => togglePar(t, pk)}><EyeOffIcon /></button>
      </div>
    </div>
  );
}

/* ---------------- textos y bloques insertados ---------------- */

function TextItem({ host, sid, i, id, v }: { host: Template; sid: string; i: number; id: string; v: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => { const el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } }, [v]);
  useEffect(() => { if (!v && ref.current && document.activeElement === document.body) ref.current.focus(); }, []); // eslint-disable-line
  return (
    <div className="par item txt">
      <textarea ref={ref} className="xtra" rows={1} value={v} placeholder="Escribe aquí…" onChange={(e) => setItemText(host, sid, id, e.target.value)} />
      <div className="it-tools">
        <button className="btn ic sm" title="Subir" aria-label="Subir" onClick={() => moveItem(host, sid, i, -1)}>↑</button>
        <button className="btn ic sm" title="Bajar" aria-label="Bajar" onClick={() => moveItem(host, sid, i, 1)}>↓</button>
        <button className="btn ic sm" title="Quitar este texto" aria-label="Quitar este texto" onClick={() => removeItem(host, sid, i)}>×</button>
      </div>
    </div>
  );
}

function InsertedBlock({ host, sid, i, u, base, min }: { host: Template; sid: string; i: number; u: string; base: string; min?: boolean }) {
  const v = insertedTpl(u, base);
  if (!v) return <div className="ins item"><div className="ins-head"><span className="ins-title">Bloque no disponible ({base})</span><button className="btn sm" onClick={() => removeItem(host, sid, i)}>Quitar</button></div></div>;
  const pv = min ? noteText(v).replace(/\s+/g, ' ').trim() : '';
  return (
    <div className={`ins item${min ? ' mini' : ''}`} data-tid={v.id} id={'blk-' + v.id}>
      <div className="ins-head">
        <button className="btn ic sm mintog" aria-expanded={!min} title={min ? 'Expandir para editar' : 'Minimizar: sigue en la nota, pero ocupa menos espacio'} onClick={() => toggleItemMin(host, sid, i)}>{min ? '▸' : '▾'}</button>
        <span className="ins-title">{v.name}</span>
        {!min && (<>
          {v.normal && <button className="btn sm" onClick={() => markAllNormal(v)}>Todo normal</button>}
          <button className="btn ic sm" title="Subir" aria-label="Subir" onClick={() => moveItem(host, sid, i, -1)}>↑</button>
          <button className="btn ic sm" title="Bajar" aria-label="Bajar" onClick={() => moveItem(host, sid, i, 1)}>↓</button>
          <button className="btn sm" title="Insertar una copia exacta debajo" onClick={() => duplicateItem(host, sid, i)}>Duplicar</button>
          <button className="btn sm" onClick={() => removeItem(host, sid, i)}>Quitar bloque</button>
        </>)}
      </div>
      {min
        ? <button className="mini-prev" title="Expandir para editar" onClick={() => toggleItemMin(host, sid, i)}>{pv ? (pv.length > 220 ? pv.slice(0, 217) + '…' : pv) : <i>Sin contenido todavía</i>}</button>
        : <TemplateBody t={v} />}
    </div>
  );
}

/* ---------------- cuerpo de una plantilla ---------------- */

export function TemplateBody({ t }: { t: Template }) {
  useApp((s) => s.notes[t.id]);
  useApp((s) => s.settings.vis);
  const n = noteOf(t), vis = visOf(t), seen = new Set<string>();
  return (
    <div data-tid={t.id}>
      {t.sections.map((s) => {
        const on = secOn(vis, s);
        const L = (n.items[s.id] || []).filter((x) => x.k === 'x' || !t.virtual);
        const host = !t.virtual;
        const pt = (i: number) => host ? (
          <div className="inspt" key={'pt' + i}><button title="Insertar aquí un bloque o texto" aria-label="Insertar aquí" onClick={() => openPalette(t, s.id, i)}>+</button></div>
        ) : null;
        return (
          <section key={s.id} className={`sec${on ? '' : ' off'}`} data-sid={s.id} id={`sec-${t.id}-${s.id}`}>
            <div className="sec-head">
              <span className="sec-title">{s.title}</span><span className="rule" />
              <button className="toggle" onClick={() => toggleSection(t, s.id, !on)}>{on ? 'Ocultar sección' : 'Mostrar sección'}</button>
            </div>
            {on && (<>
              {s.blocks.map((b, i) => parHidden(vis, s.id, i)
                ? (
                  <div className="par-off" key={s.id + ':' + i}>
                    <span className="peek">{b.replace(TOK, '…').replace(/\*\*/g, '')}</span>
                    <button onClick={() => togglePar(t, s.id + ':' + i)}>Mostrar</button>
                  </div>
                )
                : paragraph(t, n, s.id, i, b, seen))}
              {L.length > 0 && pt(0)}
              {L.map((it, i) => (
                <div key={it.k === 'x' ? it.id : it.uid}>
                  {it.k === 'x'
                    ? <TextItem host={t} sid={s.id} i={i} id={it.id} v={it.v} />
                    : <InsertedBlock host={t} sid={s.id} i={i} u={it.uid} base={it.base} min={it.min} />}
                  {i < L.length - 1 && pt(i + 1)}
                </div>
              ))}
              <div className="sec-add">
                <button className="addtxt" onClick={() => addText(t, s.id, null)}>+ Agregar texto</button>
                {host && <button className="addtxt addblk" onClick={() => openPalette(t, s.id, L.length)}>+ Insertar bloque</button>}
              </div>
            </>)}
          </section>
        );
      })}
    </div>
  );
}
