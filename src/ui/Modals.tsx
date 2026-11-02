/** Ventanas: atajos de teclado / bienvenida y guardar nota compuesta. */
import { useState } from 'react';
import { openTpl, updateSettings, useApp } from '../state/store';
import { blocksOfNote, writeCombo } from './actions';

const KEYS: [string, string][] = [
  ['Tab / Shift+Tab', 'Siguiente o anterior pendiente'],
  ['1 a 9', 'Elige la opción del grupo resaltado'],
  ['Retroceso', 'Borra la elección del grupo resaltado'],
  ['Ctrl+Enter', 'Copia la nota'],
  ['Ctrl+Z / Ctrl+Shift+Z', 'Deshacer / rehacer'],
  ['/', 'Insertar un bloque o texto'],
  ['Alt+N', 'Nota libre'],
  ['Ctrl+K', 'Buscar nota'],
  ['Esc', 'Cerrar ventanas y listas'],
];

export function Modals() {
  const modal = useApp((s) => s.modal);
  const catalog = useApp((s) => s.catalog);
  const [name, setName] = useState('');
  const [short, setShort] = useState('');
  if (!modal) return null;
  const close = () => { useApp.setState({ modal: null }); setName(''); setShort(''); };

  if (modal.kind === 'keys') {
    return (
      <div className="modal show" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
        <div className="modal-box" role="dialog" aria-modal="true" aria-label="Ayuda">
          {modal.welcome && (<>
            <h2>Bienvenido a Notarium</h2>
            <ol className="tour">
              <li>Elige una nota en el panel o empieza una <b>Nota libre</b>.</li>
              <li>Toca las opciones subrayadas y llena los campos; lo que no elijas sale entre corchetes y lo vacío no sale.</li>
              <li>Inserta bloques (exámenes, cuestionarios, plan…) con <b>+</b> o con <b>/</b>.</li>
              <li><b>Copiar nota</b> y pégala en la historia clínica. No se guardan datos de pacientes.</li>
            </ol>
            <h3>Atajos de teclado</h3>
          </>)}
          {!modal.welcome && <h2>Atajos de teclado</h2>}
          <dl className="kl">{KEYS.map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
          <div className="row"><button className="btn primary" onClick={() => { updateSettings((s) => { s.tourDone = true; }); close(); }}>Entendido</button></div>
        </div>
      </div>
    );
  }

  const t = catalog.byId.get(modal.tplId);
  if (!t) return null;
  const blocks = blocksOfNote(t);
  const save = () => {
    if (!name.trim()) return;
    const id = writeCombo(null, name.trim(), short.trim().toUpperCase(), t.combo ? t.combo.base : t.id, blocks);
    close();
    openTpl(id);
  };
  return (
    <div className="modal show" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-label="Guardar como nota compuesta">
        <h2>Guardar como nota compuesta</h2>
        <p className="muted">Guarda <b>{t.combo ? catalog.byId.get(t.combo.base)?.name : t.name}</b> con sus {blocks.length} bloques insertados ({blocks.map((b) => catalog.byId.get(b.template)?.name).filter(Boolean).join(', ')}). La próxima vez se abre ya armada.</p>
        <label className="cv-l">Nombre<input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} placeholder="Ej. Primera vez columna lumbar" /></label>
        <label className="cv-l">Código (opcional)<input value={short} maxLength={8} onChange={(e) => setShort(e.target.value)} /></label>
        <div className="row"><button className="btn primary" onClick={save} disabled={!name.trim()}>Guardar</button><button className="btn" onClick={close}>Cancelar</button></div>
      </div>
    </div>
  );
}
