/** Ventanas: bienvenida, atajos, copiar con pendientes y guardar nota compuesta. */
import { useEffect, useState } from 'react';
import { copyNote, copyText, currentTpl, openTpl, pendingList, setView, toast, updateSettings, useApp } from '../state/store';
import { useSheetUI } from './Sheet';
import { blocksOfNote, writeCombo } from './actions';
import { openBundle, transferLink, type Bundle } from '../state/transfer';

const isPhone = () => window.matchMedia?.('(max-width: 820px)').matches;
const canShare = () => typeof navigator.share === 'function';

function SendModal({ onClose }: { onClose: () => void }) {
  const [link, setLink] = useState('');
  useEffect(() => { transferLink().then(setLink); }, []);
  const t = currentTpl();
  const header = !!useApp.getState().settings.vis[t.baseId || t.id]?.sec?.s0;
  const share = async () => {
    if (canShare()) {
      try { await navigator.share({ title: 'Notarium: ' + t.name, text: 'Abre este enlace para seguir la nota en Notarium.', url: link }); onClose(); return; }
      catch (e) { if ((e as Error).name === 'AbortError') return; }
    }
    const ok = await copyText(link);
    toast(ok ? 'Enlace copiado. Envíatelo (correo, WhatsApp, notas) y ábrelo en el otro dispositivo.' : 'No se pudo copiar el enlace', !ok);
    if (ok) onClose();
  };
  return (
    <Box label="Seguir en otro dispositivo" onClose={onClose}>
      <h2>Seguir esta nota en {isPhone() ? 'el computador' : 'otro dispositivo'}</h2>
      <ol className="tour">
        <li>{canShare() ? 'Toca Compartir y envíate el enlace' : 'Copia el enlace y envíatelo'} por correo, WhatsApp o tus notas.</li>
        <li>Ábrelo en el otro dispositivo: la nota aparece tal como la dejaste, con sus bloques.</li>
      </ol>
      <p className="muted">El enlace lleva lo que escribiste en la nota (no tus plantillas). No pasa por ningún servidor de Notarium, pero sí por donde lo envíes: <b>envíatelo solo a ti y evita nombres o documentos del paciente</b>.{header ? ' Esta nota tiene visible el encabezado con datos del paciente.' : ''}</p>
      <div className="row">
        <button className="btn primary" disabled={!link} onClick={share}>{canShare() ? 'Compartir enlace' : 'Copiar enlace'}</button>
        <button className="btn" onClick={onClose}>Cancelar</button>
      </div>
      {link && <p className="muted">Tamaño del enlace: {link.length.toLocaleString('es-CO')} caracteres.</p>}
    </Box>
  );
}

function ReceiveModal({ b, onClose }: { b: Bundle; onClose: () => void }) {
  const open = Object.keys(useApp.getState().notes).length > 0;
  const when = new Date(b.started ?? b.at).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  return (
    <Box label="Nota recibida" onClose={onClose}>
      <h2>Llegó una nota: {b.name}</h2>
      <p>Empezada el {when} en otro dispositivo.{open ? ' Abrirla reemplaza las notas que tienes abiertas aquí (puedes deshacer).' : ''}</p>
      <div className="row">
        <button className="btn primary" autoFocus onClick={() => openBundle(b)}>Abrir y seguir</button>
        <button className="btn" onClick={onClose}>Descartar</button>
      </div>
    </Box>
  );
}

const KEYS: [string, string][] = [
  ['Tab / Shift+Tab', 'Siguiente o anterior pendiente'],
  ['1 a 9', 'Elige la opción del grupo resaltado'],
  ['Retroceso', 'Borra la elección del grupo resaltado'],
  ['Ctrl+Enter', 'Copia la nota'],
  ['Alt+P', 'Paciente nuevo (borra las notas abiertas)'],
  ['Ctrl+Z / Ctrl+Shift+Z', 'Deshacer / rehacer'],
  ['/', 'Insertar un bloque o texto'],
  ['Alt+N', 'Nota libre'],
  ['Ctrl+K', 'Buscar nota'],
  ['Esc', 'Cerrar ventanas y listas'],
];
const touch = () => window.matchMedia?.('(hover: none)').matches;

function Box({ label, children, onClose }: { label: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal show" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" role="dialog" aria-modal="true" aria-label={label}>{children}</div>
    </div>
  );
}

/** Lleva a un pendiente concreto y lo resalta. */
function gotoPending(tid: string, key: string) {
  useApp.setState({ modal: null });
  setTimeout(() => {
    const el = document.querySelector<HTMLElement>(`#sheet [data-tid="${tid}"][data-gk="${key}"]`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.focus({ preventScroll: true });
    if (el.classList.contains('cmp')) useSheetUI.setState({ openGrp: tid + '|' + key });
  }, 30);
}

function CopyModal({ onClose }: { onClose: () => void }) {
  const L = pendingList(currentTpl());
  return (
    <Box label="Quedan opciones sin elegir" onClose={onClose}>
      <h2>Quedan {L.length} {L.length === 1 ? 'opción' : 'opciones'} sin elegir</h2>
      <p className="muted">Si copias igual, en la historia quedarán entre corchetes, por ejemplo <code>[lado]</code>.</p>
      <ul className="pend-list">
        {L.slice(0, 12).map((x, i) => (
          <li key={i}><button className="linkish" onClick={() => gotoPending(x.tid, x.key)}>{x.label}</button> <span className="muted">· {x.where}</span></li>
        ))}
        {L.length > 12 && <li className="muted">y {L.length - 12} más…</li>}
      </ul>
      <div className="row">
        <button className="btn primary" autoFocus onClick={() => L[0] && gotoPending(L[0].tid, L[0].key)}>Completar</button>
        <button className="btn" onClick={() => copyNote('omit')} title="Las frases que tienen algo sin elegir no se copian">Copiar sin esas frases</button>
        <button className="btn danger" onClick={() => copyNote('force')}>Copiar con [corchetes]</button>
      </div>
    </Box>
  );
}

function ProfileFields({ compact }: { compact?: boolean }) {
  const p = useApp((s) => s.settings.profile) || {};
  const up = (k: 'name' | 'reg' | 'specialty', v: string) => updateSettings((s) => { s.profile = { ...(s.profile || {}), [k]: v }; });
  return (
    <div className={compact ? '' : 'ed-meta'}>
      <label className="cv-l">Nombre como firma<input value={p.name || ''} placeholder="Dr. Nombre Apellido" onChange={(e) => up('name', e.target.value)} /></label>
      <label className="cv-l">Registro médico (opcional)<input value={p.reg || ''} placeholder="RM 12345" onChange={(e) => up('reg', e.target.value)} /></label>
    </div>
  );
}

export function ProfileView() {
  const p = useApp((s) => s.settings.profile) || {};
  return (
    <>
      <div className="bar">
        <button className="btn mob" onClick={() => useApp.setState({ pickOpen: true })} aria-label="Abrir lista de notas">☰</button>
        <h1>Mi perfil y firma</h1>
        <span className="bar-gap" />
        <button className="btn primary" onClick={() => setView('note')}>Volver a la nota</button>
      </div>
      <div className="about">
        <section className="card">
          <h2>Firma de las notas</h2>
          <p>Las plantillas firman con estos datos en el campo del médico. Se guardan solo en este navegador y van en tu respaldo.</p>
          <ProfileFields />
          <p className="muted">Así saldrá: <b>{p.name ? (p.reg ? `${p.name} (RM ${p.reg})` : p.name) : 'el nombre escrito en cada plantilla'}</b>. Los cambios aplican a las notas nuevas.</p>
        </section>
      </div>
    </>
  );
}

export function Modals() {
  const modal = useApp((s) => s.modal);
  const catalog = useApp((s) => s.catalog);
  const [name, setName] = useState('');
  const [short, setShort] = useState('');
  if (!modal) return null;
  const close = () => { useApp.setState({ modal: null }); setName(''); setShort(''); };

  if (modal.kind === 'copy') return <CopyModal onClose={close} />;
  if (modal.kind === 'send') return <SendModal onClose={close} />;
  if (modal.kind === 'receive') return <ReceiveModal b={modal.bundle} onClose={close} />;

  if (modal.kind === 'keys') {
    const done = () => { updateSettings((s) => { s.tourDone = true; }); close(); };
    return (
      <Box label="Ayuda" onClose={done}>
        {modal.welcome && (<>
          <h2>Bienvenido a Notarium</h2>
          <ol className="tour">
            <li>Elige una nota en la lista o empieza una <b>Nota libre</b>.</li>
            <li>Toca las opciones y llena los campos. Lo que no elijas sale entre corchetes; lo que dejes vacío no sale.</li>
            <li>Inserta bloques (exámenes, cuestionarios, plan…) con <b>+ Insertar bloque</b>.</li>
            <li><b>Copiar nota</b> y pégala en la historia clínica. Con <b>Paciente nuevo</b> empiezas de cero; nada del paciente queda guardado.</li>
          </ol>
          <h3>¿Con qué nombre firmas?</h3>
          <ProfileFields compact />
        </>)}
        {!touch() && (<>
          <h3>{modal.welcome ? 'Atajos de teclado' : ''}</h3>
          {!modal.welcome && <h2>Atajos de teclado</h2>}
          <dl className="kl">{KEYS.map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
        </>)}
        <div className="row"><button className="btn primary" onClick={done}>Empezar</button></div>
      </Box>
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
    <Box label="Guardar como nota compuesta" onClose={close}>
      <h2>Guardar como nota compuesta</h2>
      <p className="muted">Guarda <b>{t.combo ? catalog.byId.get(t.combo.base)?.name : t.name}</b> con sus {blocks.length} bloques insertados ({blocks.map((b) => catalog.byId.get(b.template)?.name).filter(Boolean).join(', ')}). La próxima vez se abre ya armada.</p>
      <label className="cv-l">Nombre<input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} placeholder="Ej. Primera vez columna lumbar" /></label>
      <label className="cv-l">Código (opcional)<input value={short} maxLength={8} onChange={(e) => setShort(e.target.value)} /></label>
      <div className="row"><button className="btn primary" onClick={save} disabled={!name.trim()}>Guardar</button><button className="btn" onClick={close}>Cancelar</button></div>
    </Box>
  );
}
