import { memo } from 'react';
/** Panel lateral: búsqueda, pestañas Notas/Bloques, favoritas, recientes y grupos. */
import { COLLAPSED_BY_DEFAULT } from '../content/builtin';
import { isBlockTpl, isNoteTpl, type CatalogTemplate } from '../state/catalog';
import { openFree, openTpl, setView, updateSettings, useApp } from '../state/store';
import { newTemplate } from './actions';

export const norm = (s: string) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');

export const Sidebar = memo(function Sidebar({ version }: { version: string }) {
  // suscripciones puntuales: el panel no se vuelve a dibujar al escribir en la nota
  const catalog = useApp((s) => s.catalog);
  const settings = useApp((s) => s.settings);
  const query = useApp((s) => s.query);
  const tplId = useApp((s) => s.tplId);
  const view = useApp((s) => s.view);
  const backend = useApp((s) => s.backend);
  const custom = useApp((s) => s.custom);
  const tab = settings.ptab === 'blk' ? 'blk' : 'notas';
  const inTab = (t?: CatalogTemplate) => !!t && (tab === 'blk' ? isBlockTpl(t) : isNoteTpl(t));
  const all = catalog.list.filter(inTab);
  const q = norm(query.trim());
  const hasOwn = Object.keys(custom).length > 0;
  const needsBackup = hasOwn && (!settings.lastBackup || Date.now() - settings.lastBackup > 14 * 864e5);
  const fav = settings.fav;

  const row = (t: CatalogTemplate) => (
    <div key={t.id} className={`tpl-row${t.id === tplId && view === 'note' ? ' cur' : ''}`}>
      <button className="tpl" onClick={() => openTpl(t.id)}>
        <span className="nm">
          {t.combo && <span className="cmb" title="Nota compuesta">⧉</span>}
          {t.textOnly && t.use !== 'nota' && <span className="cmb txt" title="Bloque de texto">¶</span>}
          {t.name}
        </span>
        <span className="code">{t.short}</span>
      </button>
      <button className="star" aria-pressed={fav.includes(t.id)} aria-label={fav.includes(t.id) ? 'Quitar de favoritas' : 'Marcar como favorita'}
        onClick={() => updateSettings((s) => { s.fav = s.fav.includes(t.id) ? s.fav.filter((x) => x !== t.id) : [...s.fav, t.id]; })}>
        {fav.includes(t.id) ? '★' : '☆'}
      </button>
    </div>
  );

  let body: React.ReactNode;
  if (q) {
    const hits = all.filter((t) => norm(t.name + ' ' + t.short + ' ' + t.group).includes(q));
    body = hits.length
      ? (<><div className="group-name">Resultados</div>{hits.map(row)}</>)
      : (
        <p className="empty-q">
          {tab === 'blk' ? 'Ningún bloque coincide.' : 'Ninguna nota coincide. Prueba con el código, por ejemplo TFESI.'}{' '}
          <button className="linkish" onClick={() => updateSettings((s) => { s.ptab = tab === 'blk' ? 'notas' : 'blk'; })}>Buscar en {tab === 'blk' ? 'Notas' : 'Bloques'}</button>
        </p>
      );
  } else {
    const favs = fav.map((id) => catalog.byId.get(id)).filter(inTab) as CatalogTemplate[];
    const rec = settings.recent.map((id) => catalog.byId.get(id)).filter((t) => inTab(t) && !fav.includes(t!.id)).slice(0, 4) as CatalogTemplate[];
    const saved = settings.collapsed || {};
    const col = new Proxy(saved, { get: (o, g: string) => (g in o ? o[g] : COLLAPSED_BY_DEFAULT.includes(g)) }) as Record<string, boolean>;
    const groups = catalog.groups.map((g) => [g, all.filter((t) => t.group === g && t.id !== 'libre')] as const).filter(([, l]) => l.length);
    body = (<>
      {tab === 'blk' && <p className="tab-help">Bloques: piezas para insertar en una nota con <b>/</b> o con <b>+</b>. También puedes abrir cualquiera sola.</p>}
      {favs.length > 0 && <><div className="group-name">Favoritas</div>{favs.map(row)}</>}
      {rec.length > 0 && <><div className="group-name">Recientes</div>{rec.map(row)}</>}
      {groups.map(([g, list]) => (
        <div key={g}>
          <button className="group-name gtog" aria-expanded={!col[g]}
            onClick={() => updateSettings((s) => { const c = (s.collapsed = s.collapsed || {}); c[g] = !col[g]; })}>
            <span className="car">{col[g] ? '▸' : '▾'}</span>{g}<span className="cnt">{list.length}</span>
          </button>
          {!col[g] && list.map(row)}
        </div>
      ))}
    </>);
  }

  return (
    <aside>
      <div className="brand-row"><span className="brand">Notarium</span><button className="close-pick" onClick={() => useApp.setState({ pickOpen: false })}>Cerrar</button></div>
      <button className="newfree" title="Hoja en blanco para armar la nota con bloques y texto (Alt+N)" onClick={openFree}>
        <span className="nf-i" aria-hidden="true">+</span>Nota libre<kbd>Alt+N</kbd>
      </button>
      <input id="q" className="search" type="search" autoComplete="off" aria-label="Buscar"
        placeholder={(tab === 'blk' ? 'Buscar bloque' : 'Buscar nota') + (isMac ? '  (⌘K)' : '  (Ctrl+K)')}
        value={query} onChange={(e) => useApp.setState({ query: e.target.value })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const first = all.find((t) => norm(t.name + ' ' + t.short + ' ' + t.group).includes(q));
            if (first) { openTpl(first.id); useApp.setState({ query: '' }); }
          }
        }} />
      <div className="ptabs" role="group" aria-label="Notas o bloques">
        <button aria-pressed={tab === 'notas'} onClick={() => updateSettings((s) => { s.ptab = 'notas'; })}>Notas</button>
        <button aria-pressed={tab === 'blk'} onClick={() => updateSettings((s) => { s.ptab = 'blk'; })}>Bloques</button>
      </div>
      <div id="plist">{body}</div>
      <div className="side-tools" role="group" aria-label="Herramientas">
        <button className="tool" title="Crear una nota nueva" onClick={() => newTemplate('nota')}><span className="ti" aria-hidden="true">＋</span>Nota</button>
        <button className="tool" title="Crear un bloque nuevo" onClick={() => newTemplate('bloque')}><span className="ti" aria-hidden="true">＋</span>Bloque</button>
        <button className="tool tool-wide" title="Exportar o importar respaldo y ver versiones" onClick={() => setView('about')}>
          <span className="ti" aria-hidden="true">⤓</span>Respaldo y versiones ({version})
        </button>
        {needsBackup && (
          <button className="tool tool-wide backup-due" onClick={() => setView('about')}>
            <span className="ti" aria-hidden="true">!</span>{settings.lastBackup ? 'Haz un respaldo: el último fue hace más de 2 semanas' : 'Aún no tienes respaldo de tus plantillas'}
          </button>
        )}
        <div className="side-foot">{backend.label}</div>
      </div>
    </aside>
  );
});
