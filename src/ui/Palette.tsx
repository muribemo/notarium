/** Paleta para insertar un bloque o texto libre en un punto de la nota. */
import { useEffect, useRef, useState } from 'react';
import { isBlockTpl } from '../state/catalog';
import { addBlock, addText, tplById, useApp } from '../state/store';
import { norm } from './Sidebar';

interface Entry { kind: 'x' | 'b'; id?: string; name: string; group: string; short?: string }

export function Palette() {
  const pal = useApp((s) => s.palette);
  const catalog = useApp((s) => s.catalog);
  const useBlk = useApp((s) => s.settings.useBlk) || {};
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { setQ(''); setSel(0); }, [pal]);
  useEffect(() => { listRef.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest' }); }, [sel]);
  if (!pal) return null;
  const host = tplById(pal.host);
  const nq = norm(q.trim());
  const blocks = catalog.list.filter((t) => isBlockTpl(t) && t.id !== host?.baseId && t.id !== host?.id)
    .filter((t) => !nq || norm(t.name + ' ' + t.short + ' ' + t.group).includes(nq));
  const used = blocks.filter((t) => useBlk[t.id]).sort((a, b) => (useBlk[b.id] || 0) - (useBlk[a.id] || 0)).slice(0, nq ? 0 : 5);
  const L: Entry[] = [
    ...(!nq || norm('texto libre escribir').includes(nq) ? [{ kind: 'x' as const, name: 'Texto libre', group: 'Escribir' }] : []),
    ...used.map((t) => ({ kind: 'b' as const, id: t.id, name: t.name, group: 'Más usados', short: t.short })),
    ...blocks.map((t) => ({ kind: 'b' as const, id: t.id, name: t.name, group: t.group, short: t.short })),
  ];
  const close = () => useApp.setState({ palette: null });
  const choose = (i: number) => {
    const x = L[i];
    if (!x || !host) return;
    close();
    if (x.kind === 'x') addText(host, pal.sid, pal.idx);
    else {
      const it = addBlock(host, pal.sid, pal.idx, x.id!);
      setTimeout(() => document.getElementById('blk-ins_' + (it.k === 'b' ? it.uid : ''))?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 30);
    }
  };
  let g: string | null = null;
  return (
    <div className="modal pal show" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="pal-box" role="dialog" aria-modal="true" aria-label="Insertar">
        <input className="search" autoFocus placeholder="Buscar bloque para insertar…" value={q}
          onChange={(e) => { setQ(e.target.value); setSel(0); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setSel((sel + 1) % Math.max(L.length, 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setSel((sel + L.length - 1) % Math.max(L.length, 1)); }
            if (e.key === 'Enter') { e.preventDefault(); choose(sel); }
            if (e.key === 'Escape') { e.preventDefault(); close(); }
          }} />
        <div id="pallist" ref={listRef}>
          {L.length ? L.map((x, i) => {
            const head = x.group !== g ? <div className="pal-g" key={'g' + i}>{(g = x.group)}</div> : null;
            return [head, (
              <button key={i} className={`pal-it${i === sel ? ' on' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => choose(i)}>
                {x.name}{x.short ? <span>{x.short}</span> : null}
              </button>
            )];
          }) : <p className="pal-h muted">Ningún bloque coincide.</p>}
        </div>
        <p className="pal-h muted">↑ ↓ para moverte, Enter para insertar, Esc para cerrar.</p>
      </div>
    </div>
  );
}
