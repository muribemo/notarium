import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { closeToast, showHint, useApp } from '../state/store';
import { VERSION } from '../version';
import { About } from './About';
import { Editor } from './Editor';
import { onKeyDown } from './keyboard';
import { Modals } from './Modals';
import { NoteView } from './NoteView';
import { Palette } from './Palette';
import { useSheetUI } from './Sheet';
import { Sidebar } from './Sidebar';

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

  useEffect(() => {
    document.addEventListener('keydown', onKeyDown);
    const closePop = (e: MouseEvent) => {
      if (useSheetUI.getState().openGrp && !(e.target as HTMLElement).closest?.('.grp.cmp')) useSheetUI.setState({ openGrp: null });
    };
    document.addEventListener('click', closePop);
    return () => { document.removeEventListener('keydown', onKeyDown); document.removeEventListener('click', closePop); };
  }, []);
  useEffect(() => { document.body.classList.toggle('pick', pickOpen); }, [pickOpen]);
  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
  }, [theme]);
  useEffect(() => {
    if (!tourDone) { const t = setTimeout(() => useApp.setState({ modal: { kind: 'keys', welcome: true } }), 600); return () => clearTimeout(t); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app">
      <Sidebar version={VERSION} />
      <main>
        {view === 'editor' ? <Editor key={useApp.getState().editing?.id || 'new'} /> : view === 'about' ? <About /> : <NoteView />}
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
