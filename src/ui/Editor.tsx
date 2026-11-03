/** Editor de plantillas propias y de versiones propias de las incluidas. */
import { useMemo, useState } from 'react';
import { parseTemplate } from '../engine/parse';
import { toText } from '../engine/text';
import { freshFor, setView, useApp, type EditorDraft } from '../state/store';
import { deleteCustom, restoreOriginal, saveEditor } from './actions';
import { TemplateBody } from './Sheet';

const HELP: [string, React.ReactNode][] = [
  ['## Técnica', <>Empieza una sección. Con <code>(oculta)</code> al final arranca oculta.</>],
  ['[derecho / izquierdo]', <>Opciones para tocar. Sepáralas con una barra con espacios, así <code>mg/kg</code> no se parte.</>],
  ['[lado: derecho / izquierdo]', <>Opciones con nombre. Más adelante <code>{'{lado}'}</code> repite lo que elegiste.</>],
  ['[sin bolo / administrar {dosis} mg]', <>Un campo <b>dentro de una opción</b> solo aparece cuando esa opción está elegida.</>],
  ['[* dipirona 2 g / ketorolaco 30 mg]', <>Permite elegir varias; se unen con comas e "y".</>],
  ['[- no reanimación / no intubación]', <>Como <code>[* … ]</code>, pero cada opción elegida sale en su propia línea con guion.</>],
  ['[* 0 sin hallazgos / dolor / edema]', <>Un <b>0</b> antes de la opción la vuelve <b>excluyente</b>: si la marcas se quitan las demás.</>],
  ['[!triamcinolona 40 mg]', <>El signo ! marca una opción en rojo, como advertencia.</>],
  ['[aguja roma (? reduce el riesgo intravascular)]', <>Una <b>pista</b> que aparece al elegir esa opción. Con <code>?? texto</code> como última opción, la pista es del campo.</>],
  ['{peso}', <>Campo para escribir. <code>{'{fecha=hoy}'}</code> pone la fecha, <code>{'{hora=ahora}'}</code> la hora; <code>{'{médico=Dr. …}'}</code> trae un valor ya escrito (el campo <i>médico</i> usa tu perfil).</>],
  ['[@aguja: 22 G / 25 G]', <>El @ recuerda tu elección para la siguiente nota. Úsalo para la técnica, nunca para el lado.</>],
  ['[^…]  [~…]', <>Fuerza (^) o evita (~) la mayúscula inicial de lo elegido.</>],
  ['[#opioides] [%anestésicos] [?dn4]', <>Calculadora de opioides, de anestésico local o un cuestionario (dn4, pdq, bpi, esas, pps, ecog, odi, ndi, stopbang, ort, phq4, painad, kps, rass, barthel, cam).</>],
  ['**Antecedentes**', <>Una línea solo en negrita es un <b>subtítulo</b>.</>],
  ['**Técnica:**', <>Negrita. Una línea en blanco separa párrafos.</>],
];

export function Editor() {
  const draft = useApp((s) => s.editing);
  const custom = useApp((s) => s.custom);
  const [d, setD] = useState<EditorDraft>(draft!);
  const [err, setErr] = useState<string | null>(null);
  const [arm, setArm] = useState(false);
  const preview = useMemo(() => parseTemplate({ id: '__preview', name: d.name || 'Vista previa', lang: d.lang, use: d.use, insert: d.insMode, normal: d.normal }, d.source), [d.source, d.name, d.lang, d.use, d.insMode, d.normal]);
  const text = useMemo(() => {
    const n = freshFor(preview);
    return toText(preview, { note: () => n, vis: () => undefined, inserted: () => undefined });
  }, [preview]);
  const nVars = Object.keys(preview.vars).length;
  const up = (p: Partial<EditorDraft>) => { setD({ ...d, ...p }); setErr(null); setArm(false); };
  const isCustom = !d.builtin && d.id && custom[d.id];

  return (
    <>
      <div className="bar">
        <button className="btn mob" onClick={() => useApp.setState({ pickOpen: true })} aria-label="Abrir lista de notas">☰</button>
        <h1>{d.builtin ? `Editar: ${d.name}` : d.id ? 'Editar plantilla' : d.use === 'bloque' ? 'Nuevo bloque' : 'Nueva plantilla'}</h1>
        <span className="bar-gap" />
        <button className="btn" onClick={() => { useApp.setState({ editing: null }); setView('note'); }}>Cancelar</button>
        {d.id && <button className="btn" onClick={() => setErr(saveEditor(d, true))}>Guardar como nueva</button>}
        <button className="btn primary" onClick={() => setErr(saveEditor(d))}>Guardar</button>
      </div>
      <div className="editor">
        <div className="ed-meta">
          <label>Nombre<input value={d.name} onChange={(e) => up({ name: e.target.value })} placeholder="Ej. Bloqueo del plano erector" /></label>
          <label className="sm">Código<input value={d.short} maxLength={8} onChange={(e) => up({ short: e.target.value })} placeholder="ESP" /></label>
          {!d.builtin && <label>Grupo<input value={d.group} onChange={(e) => up({ group: e.target.value })} /></label>}
          <label className="sm">Idioma<select value={d.lang} onChange={(e) => up({ lang: e.target.value as 'es' | 'en' })}><option value="es">Español</option><option value="en">Inglés</option></select></label>
          <label className="sm">Uso<select value={d.use} onChange={(e) => up({ use: e.target.value as EditorDraft['use'] })}>
            <option value="nota">Nota</option><option value="bloque">Bloque</option><option value="ambos">Nota y bloque</option></select></label>
          <label className="sm">Al insertar<select value={d.insMode} onChange={(e) => up({ insMode: e.target.value as EditorDraft['insMode'] })}>
            <option value="seccion">Con subtítulo</option><option value="texto">Como texto</option></select></label>
          <label className="chk"><input type="checkbox" checked={d.normal} disabled={d.normalLocked} onChange={(e) => up({ normal: e.target.checked })} />
            Botón Todo normal<span className="muted">elige la primera opción de cada grupo</span></label>
        </div>
        <div className="ed-grid">
          <div>
            <span className="ed-lab">Plantilla</span>
            <textarea id="src" spellCheck={false} value={d.source} onChange={(e) => up({ source: e.target.value })} />
            <details className="help" open={!Object.keys(custom).length}>
              <summary>Cómo escribir la plantilla</summary>
              <dl>{HELP.map(([k, v]) => <div key={k} style={{ display: 'contents' }}><dt><code>{k}</code></dt><dd>{v}</dd></div>)}</dl>
            </details>
          </div>
          <div>
            <span className="ed-lab">Vista previa</span>
            <p className="prev-chip">{preview.sections.length} {preview.sections.length === 1 ? 'sección' : 'secciones'} y {nVars} {nVars === 1 ? 'campo' : 'campos'}</p>
            <div className="sheet mini"><TemplateBody t={preview} /></div>
            <span className="ed-lab" style={{ marginTop: 14 }}>Texto sin elegir nada</span>
            <div className="sheet mini"><div className="preview">{text}</div></div>
          </div>
        </div>
        <div className="ed-foot">
          {err && <p className="ed-err">{err}</p>}
          <span className="bar-gap" />
          {d.builtin && d.overridden && (
            <button className="btn danger" onClick={() => { if (!arm) return setArm(true); restoreOriginal(d.id!); }}>{arm ? 'Confirmar: volver a la original' : 'Volver a la plantilla original'}</button>
          )}
          {isCustom && (
            <button className="btn danger" onClick={() => { if (!arm) return setArm(true); deleteCustom(d.id!); }}>{arm ? 'Confirmar: eliminar' : 'Eliminar plantilla'}</button>
          )}
        </div>
        {d.builtin && <p className="ed-note">Estás editando una plantilla incluida. Tus cambios quedan como tu versión; puedes volver a la original cuando quieras.</p>}
      </div>
    </>
  );
}
