/** Calculadoras y cuestionarios dentro de la hoja. */
import { fmt } from '../clinical/format';
import { LOCAL_ANESTHETICS, laCalc, laDefault, laLevel } from '../clinical/localAnesthetics';
import { OPIOIDS, REDUCTIONS, RESCUES, opioidById, opioidCalc, opioidDefault } from '../clinical/opioids';
import { QUESTS, answered } from '../clinical/questionnaires';
import type { LAValue, OpioidValue, QuestValue, Template } from '../engine/types';
import { editNote, noteOf } from '../state/store';

function edit<T>(t: Template, k: string, def: () => T, fn: (v: T) => void, typing = false) {
  editNote(t, (n) => {
    const v = (n.values[k] as T | undefined) || def();
    fn(v);
    n.values[k] = v as never;
  }, { hist: typing ? 'typing' : true });
}

export function OpioidWidget({ t, k }: { t: Template; k: string }) {
  const v = (noteOf(t).values[k] as OpioidValue) || opioidDefault();
  const c = opioidCalc(v);
  const set = (fn: (v: OpioidValue) => void, typing = false) => edit(t, k, opioidDefault, fn, typing);
  const ot = v.tgt ? opioidById(v.tgt) : null;
  return (
    <span className="opi">
      <span className="opi-h">Opioides en las últimas 24 horas</span>
      {v.rows.map((r, i) => (
        <span className="opi-row" key={i}>
          <select className="opi-sel" aria-label="Opioide" value={r.o}
            onChange={(e) => set((x) => { x.rows[i].o = e.target.value; x.rows[i].f = String(opioidById(e.target.value).f); })}>
            {OPIOIDS.map((o) => <option key={o.id} value={o.id}>{o.n}</option>)}
          </select>
          <input className="opi-in" value={r.d} placeholder="dosis" inputMode="decimal" aria-label="Dosis"
            onChange={(e) => set((x) => { x.rows[i].d = e.target.value; }, true)} />
          <span className="opi-u">{opioidById(r.o).u}</span>
          <span className="opi-x">×</span>
          <input className="opi-in fac" value={r.f} inputMode="decimal" aria-label="Factor de conversión" title="Factor de conversión a morfina oral; puedes cambiarlo"
            onChange={(e) => set((x) => { x.rows[i].f = e.target.value; }, true)} />
          <span className="opi-eq">= <b>{fmt(c.rows[i]?.mme ?? 0)}</b> mg EMM</span>
          {v.rows.length > 1 && <button className="opi-del" aria-label="Quitar este opioide" onClick={() => set((x) => { x.rows.splice(i, 1); })}>×</button>}
        </span>
      ))}
      <button className="opi-add" onClick={() => set((x) => { x.rows.push({ o: 'mor_vo', d: '', f: '1' }); })}>+ Agregar opioide</button>
      <span className="opi-tot">Total: <b>{fmt(c.total)}</b> mg de EMM en 24 h</span>
      <span className="opi-rot">
        <label>Rotar a{' '}
          <select className="opi-sel" value={v.tgt} onChange={(e) => set((x) => { x.tgt = e.target.value; delete x.tf; })}>
            <option value="">sin rotación</option>
            {OPIOIDS.filter((o) => !o.noTarget).map((o) => <option key={o.id} value={o.id}>{o.n}</option>)}
          </select>
        </label>
        {ot && (<>
          <label>factor <input className="opi-in fac" inputMode="decimal" value={v.tf != null && v.tf !== '' ? v.tf : String(ot.f)}
            onChange={(e) => set((x) => { x.tf = e.target.value; }, true)} /></label>
          <label>reducción <select className="opi-sel" value={v.red} onChange={(e) => set((x) => { x.red = e.target.value; })}>
            {REDUCTIONS.map((x) => <option key={x} value={String(x)}>{x}%</option>)}
          </select></label>
          <label>rescate <select className="opi-sel" value={v.res} onChange={(e) => set((x) => { x.res = e.target.value; })}>
            {RESCUES.map((x) => <option key={x} value={String(x)}>{x ? x + '%' : 'sin rescate'}</option>)}
          </select></label>
          <span className="opi-out">{c.rot ? `${fmt(c.rot.dose)} ${c.rot.o.u}` : ''}</span>
        </>)}
      </span>
      <span className="opi-note">Factores de referencia (CDC 2022 y tablas equianalgésicas habituales). Verifícalos e individualiza según edad, función renal y hepática. La metadona no se usa como destino de rotación aquí.</span>
    </span>
  );
}

export function LAWidget({ t, k }: { t: Template; k: string }) {
  const v = (noteOf(t).values[k] as LAValue) || laDefault();
  const c = laCalc(v), lvl = laLevel(c.tot);
  const set = (fn: (v: LAValue) => void, typing = false) => edit(t, k, laDefault, fn, typing);
  return (
    <span className="opi la">
      <span className="opi-h">Anestésicos locales</span>
      <span className="opi-row">
        <span className="opi-u">Peso</span>
        <input className="la-in opi-in" value={v.peso} placeholder="kg" inputMode="decimal" aria-label="Peso en kg" onChange={(e) => set((x) => { x.peso = e.target.value; }, true)} />
        <span className="opi-u">kg</span>
      </span>
      {v.rows.map((r, i) => (
        <span className="opi-row" key={i}>
          <select className="opi-sel" aria-label="Agente" value={r.a}
            onChange={(e) => set((x) => { const a = LOCAL_ANESTHETICS.find((q) => q.id === e.target.value)!; x.rows[i].a = a.id; x.rows[i].m = String(x.rows[i].e ? a.mE : a.m); })}>
            {LOCAL_ANESTHETICS.map((a) => <option key={a.id} value={a.id}>{a.n}</option>)}
          </select>
          <input className="opi-in" value={r.c} inputMode="decimal" aria-label="Concentración" onChange={(e) => set((x) => { x.rows[i].c = e.target.value; }, true)} />
          <span className="opi-u">%</span>
          <input className="opi-in" value={r.v} placeholder="volumen" inputMode="decimal" aria-label="Volumen" onChange={(e) => set((x) => { x.rows[i].v = e.target.value; }, true)} />
          <span className="opi-u">mL</span>
          <label className="la-e"><input type="checkbox" checked={r.e}
            onChange={(e) => set((x) => { const a = LOCAL_ANESTHETICS.find((q) => q.id === x.rows[i].a)!; x.rows[i].e = e.target.checked; x.rows[i].m = String(e.target.checked ? a.mE : a.m); })} /> epinefrina</label>
          <span className="opi-u">máx</span>
          <input className="opi-in fac" value={r.m} inputMode="decimal" aria-label="Dosis máxima en mg/kg" title="Dosis máxima en mg/kg; puedes cambiarla" onChange={(e) => set((x) => { x.rows[i].m = e.target.value; }, true)} />
          <span className="opi-u">mg/kg</span>
          <span className="opi-eq">= <b>{fmt(c.rows[i]?.mg ?? 0)}</b> mg</span>
          {v.rows.length > 1 && <button className="opi-del" aria-label="Quitar" onClick={() => set((x) => { x.rows.splice(i, 1); })}>×</button>}
        </span>
      ))}
      <button className="opi-add" onClick={() => set((x) => { x.rows.push({ a: 'lido', c: '1', v: '', e: false, m: '4.5' }); })}>+ Agregar anestésico</button>
      <span className={`opi-tot la-tot ${lvl}`}>
        {c.kg ? `Total: ${Math.round(c.tot * 100)}% de la dosis máxima` : 'Ingresa el peso para calcular el porcentaje de la dosis máxima'}
      </span>
      <span className="opi-note">Dosis máximas de referencia en mg/kg (sin / con epinefrina): lidocaína 4,5 / 7; mepivacaína 4,5 / 7; bupivacaína y levobupivacaína 2,5 / 3; ropivacaína 3. Las fracciones de varios agentes se suman. Ajusta según edad, embarazo, función hepática y cardíaca, y sitio de inyección.</span>
    </span>
  );
}

export function QuestWidget({ t, k, qid }: { t: Template; k: string; qid: string }) {
  const q = QUESTS[qid];
  if (!q) return null;
  const v = (noteOf(t).values[k] as QuestValue) || { a: {}, open: true };
  const has = answered(v, q) > 0;
  const r = has ? q.score(v, q) : { short: '' };
  const answer = (i: number, val: number) => edit<QuestValue>(t, k, () => ({ a: {}, open: true }), (x) => {
    x.a = { ...x.a };
    if (x.a[i] != null && x.a[i] === val) delete x.a[i]; else x.a[i] = val;
  });
  const btn = (i: number, val: number, lab: string) => (
    <button key={val + lab} className="qz-b" aria-pressed={v.a[i] != null && v.a[i] === val} onClick={() => answer(i, val)}>{lab}</button>
  );
  return (
    <span className="qz">
      <span className="qz-h">
        <b>{q.name}</b>
        <span className="qz-s">{r.short || 'Sin responder'}</span>
        {has && <button className="qz-t" onClick={() => edit<QuestValue>(t, k, () => ({ a: {} }), (x) => { x.a = {}; })}>Limpiar</button>}
      </span>
      <span className="qz-body">
        {q.note && <span className="qz-n">{q.note}</span>}
        {q.items.map((it, i) => (
          <span key={i} className={`qz-it${it.t === 'opt' && it.o.length > 4 ? ' col' : ''}`}>
            <span className="qz-l">{it.l}</span>
            <span className="qz-o">
              {it.t === 'yn' && [btn(i, 1, 'Sí'), btn(i, 0, 'No')]}
              {it.t === 'num' && Array.from({ length: it.max + 1 }, (_, x) => btn(i, x, String(x)))}
              {it.t === 'opt' && it.o.map((op) => btn(i, op.v, op.l))}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}
