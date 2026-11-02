/** Respaldo (exportar / importar) y registro de versiones. */
import { useRef, useState } from 'react';
import { CHANGELOG, VERSION } from '../version';
import { copyText, replaceAll, setView, toast, useApp } from '../state/store';
import { isBackup, makeBackup, mergeBackup, replaceWithBackup, type Backup } from '../state/storage';

function download(name: string, text: string): boolean {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch { return false; }
}

export function About() {
  const { custom, settings } = useApp();
  const [bk, setBk] = useState<Backup | null>(null);
  const [bad, setBad] = useState(false);
  const [arm, setArm] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const C = Object.values(custom);
  const nT = C.filter((c) => !c.override && c.kind !== 'combo').length, nC = C.filter((c) => c.kind === 'combo').length, nO = C.filter((c) => c.override).length;

  const exportBk = async () => {
    const json = JSON.stringify(makeBackup({ settings, custom }, VERSION), null, 1);
    const d = new Date(), p = (n: number) => String(n).padStart(2, '0');
    if (download(`notarium-respaldo-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`, json)) toast('Respaldo listo');
    else { const ok = await copyText(json); toast(ok ? 'No se pudo descargar; el respaldo quedó copiado.' : 'No se pudo exportar el respaldo', !ok); }
  };
  const onFile = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try { const o = JSON.parse(String(r.result)); if (isBackup(o)) { setBk(o); setBad(false); } else { setBk(null); setBad(true); } }
      catch { setBk(null); setBad(true); }
      setArm(false);
    };
    r.readAsText(f);
  };
  const apply = (mode: 'merge' | 'replace') => {
    if (!bk) return;
    replaceAll(mode === 'merge' ? mergeBackup({ settings, custom }, bk) : replaceWithBackup(bk));
    setBk(null);
    toast(mode === 'replace' ? 'Respaldo restaurado' : 'Respaldo combinado');
  };

  return (
    <>
      <div className="bar">
        <button className="btn mob" onClick={() => useApp.setState({ pickOpen: true })}>Notas</button>
        <h1>Respaldo y versiones</h1>
        <span className="bar-gap" />
        <button className="btn primary" onClick={() => setView('note')}>Volver a la nota</button>
      </div>
      <div className="about">
        <section className="card">
          <h2>Respaldo de tus datos</h2>
          <p>Incluye tus plantillas propias ({nT}), tus notas compuestas ({nC}), tus versiones de plantillas incluidas ({nO}), favoritas, técnica recordada y lo que tienes oculto. <b>No incluye datos de pacientes.</b></p>
          <p className="muted">Sirve también para traer lo que tenías en el artefacto de Notarium: allí usa <i>Respaldo y versiones → Exportar respaldo</i> e impórtalo aquí.</p>
          <div className="row">
            <button className="btn primary" onClick={exportBk}>Exportar respaldo</button>
            <label className="btn">Importar respaldo<input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} /></label>
          </div>
          {bad && <p className="err">Ese archivo no es un respaldo de Notarium.</p>}
          {bk && (<>
            <p>Respaldo de <b>{bk.version}</b> del {(bk.exported || '').slice(0, 10)}: {Object.values(bk.custom).filter((x) => !x.override && x.kind !== 'combo').length} plantillas propias, {Object.values(bk.custom).filter((x) => x.kind === 'combo').length} notas compuestas y {Object.values(bk.custom).filter((x) => x.override).length} versiones de plantillas incluidas.</p>
            <div className="row">
              <button className="btn primary" onClick={() => apply('merge')}>Combinar con lo que tengo</button>
              <button className="btn danger" onClick={() => { if (!arm) return setArm(true); apply('replace'); }}>{arm ? 'Confirmar: reemplazar todo' : 'Reemplazar todo'}</button>
              <button className="btn" onClick={() => setBk(null)}>Cancelar</button>
            </div>
            <p className="muted">Combinar agrega lo que falta y actualiza lo que sea más reciente en el respaldo. Reemplazar deja exactamente lo del respaldo.</p>
          </>)}
        </section>
        <section className="card">
          <h2>Versión</h2>
          <p>Estás usando <b>Notarium {VERSION}</b>.</p>
          <ol className="log">
            {CHANGELOG.map((c) => <li key={c.v}><b>{c.v}</b> <span className="muted">{c.d}</span><br />{c.t}</li>)}
          </ol>
        </section>
      </div>
    </>
  );
}
