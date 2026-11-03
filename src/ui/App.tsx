import { Component, useEffect, type ReactNode } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { closeToast, showHint, useApp } from '../state/store';
import { VERSION } from '../version';
import { About } from './About';
import { Editor } from './Editor';
import { onKeyDown } from './keyboard';
import { Modals, ProfileView } from './Modals';
import { NoteView } from './NoteView';
import { Palette } from './Palette';
import { useSheetUI } from './Sheet';
import { Sidebar } from './Sidebar';
import { bundleFromLocation } from '../state/transfer';

/** Si algo falla al dibujar (p. ej. una plantilla propia mal escrita), se muestra un aviso y no una pantalla en blanco. */
class Guard extends Component<{ children: ReactNode; resetKey: string }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidUpdate(prev: { resetKey: string }) { if (prev.resetKey !== this.props.resetKey && this.state.err) this.setState({ err: null }); }
  componentDidCatch(err: Error) { console.error('Notarium', err); }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="about">
        <section className="card">
          <h2>No se pudo mostrar esta nota</h2>
          <p>Algo en la plantilla impidió dibujarla. Tus otras notas y plantillas están bien.</p>
          <p className="muted">Detalle: {this.state.err.message}</p>
          <div className="row">
            <button className="btn" onClick={() => useApp.setState({ pickOpen: true })}>Elegir otra nota</button>
            <button className="btn primary" onClick={() => location.reload()}>Recargar</button>
          </div>
        </section>
      </div>
    );
  }
}

function UpdateBanner() {
  const { needRefresh: [need, setNeed], updateServiceWorker } = useRegisterSW();
  if (!need) return null;
  return (
    <div className="toast show">
      <span>Hay una versión nueva de Notarium.</span>
      <button onClick={() => updateServiceWorker(true)}>Actualizar</button>
      <button onClick={() => setNeed(false)}>Después</button>
    </div>
  );
}

export function App() {
  const view = useApp((s) => s.view);
  const pickOpen = useApp((s) => s.pickOpen);
  const hint = useApp((s) => s.hint);
  const toast = useApp((s) => s.toast);
  const theme = useApp((s) => s.settings.theme);
  const tourDone = useApp((s) => s.settings.tourDone);
  const tplId = useApp((s) => s.tplId);

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    const closePop = (e: MouseEvent) => {
      if (useSheetUI.getState().openGrp && !(e.target as HTMLElement).closest?.('.grp.cmp, .gmenu')) useSheetUI.setState({ openGrp: null });
    };
    document.addEventListener('click', closePop);
    return () => { document.removeEventListener('keydown', onKeyDown); document.removeEventListener('click', closePop); };
  }, []);
  useEffect(() => { document.body.classList.toggle('pick', pickOpen); }, [pickOpen]);
  // una nota enviada desde otro dispositivo llega en el enlace
  useEffect(() => {
    const check = () => bundleFromLocation().then((b) => { if (b) useApp.setState({ modal: { kind: 'receive', bundle: b } }); });
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }, [theme]);
  useEffect(() => {
    if (!tourDone) { const t = setTimeout(() => { if (!useApp.getState().modal) useApp.setState({ modal: { kind: 'keys', welcome: true } }); }, 600); return () => clearTimeout(t); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app">
      <Sidebar version={VERSION} />
      <main>
        <Guard resetKey={view + '|' + tplId}>
          {view === 'editor' ? <Editor key={useApp.getState().editing?.id || 'new'} /> : view === 'about' ? <About /> : view === 'profile' ? <ProfileView /> : <NoteView />}
        </Guard>
        {hint && (
          <div className={`hint show${hint.warn ? ' warn' : ''}`}>
            <button className="x" aria-label="Cerrar" onClick={() => showHint(null)}>×</button>
            <b>{hint.label}</b>{hint.text}
          </div>
        )}
      </main>
      {toast && (
        <div className={`toast show${toast.amber ? ' amber' : ''}`} key={toast.id}>
          <span>{toast.msg}</span>
          {toast.action && <button onClick={() => { closeToast(); toast.action!.fn(); }}>{toast.action.label}</button>}
        </div>
      )}
      <Palette />
      <Modals />
      <UpdateBanner />
    </div>
  );
}
