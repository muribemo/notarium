/**
 * Intérprete del mini-lenguaje de plantillas.
 *
 *   ## Sección (oculta)            sección; "(oculta)" arranca apagada
 *   [a / b]                        opción única
 *   [nombre: a / b] … {nombre}     opción con nombre; {nombre} repite lo elegido
 *   [* a / b]   [- a / b]          selección múltiple (unida con comas e "y") o en lista con guiones
 *   [* 0 normal / x]               0 = opción excluyente
 *   [!opción]                      opción con advertencia
 *   [a (? pista) / b / ?? pista]   pista de una opción / pista del campo
 *   [sin bolo / dar {dosis} mg]    campo que solo existe si se elige esa opción
 *   {campo}  {fecha=hoy}  {médico=Dr. …}
 *   [@aguja: …]  {@médico}         recordar la elección para la próxima nota
 *   [^…] {^…} / [~…] {~…}          forzar o evitar la mayúscula inicial
 *   [#opioides] [%anestésicos] [?dn4]   calculadoras y cuestionarios
 */
import { QUESTS } from '../clinical/questionnaires';
import type { Option, Section, Template, TemplateMeta, VarDef } from './types';

const NAME_RE = /^([\p{L}\p{N}_ °-]{1,30}):\s/u;
export const WARN_HINT = 'Opción marcada con advertencia en tu plantilla.';

export function slug(s: string): string {
  return (
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'campo'
  );
}

/** {fecha=hoy} pone la fecha, {hora=ahora} la hora; cualquier otro valor queda escrito por defecto. */
function applyDefault(d: VarDef, def: string) {
  if (/^(hoy|today)$/i.test(def)) d.today = true;
  else if (/^(ahora|now)$/i.test(def)) d.now = true;
  else d.def = def;
}

/** Etiqueta de un grupo sin nombre: sus opciones, cortadas en una palabra y con "…". */
export function autoLabel(opts: Option[]): string {
  const full = opts.map((o) => o.v.replace(/⟦\w+⟧/g, '…')).join(' / ');
  if (full.length <= 40) return full;
  const cut = full.slice(0, 40);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 12)).replace(/[\s/,;]+$/, '') + '…';
}

export function parseTemplate(meta: TemplateMeta, source: string): Template {
  const vars: Record<string, VarDef> = {};
  const sticky: string[] = [];
  const sections: Section[] = [];
  const names: Record<string, string> = {};
  let sec: Section | null = null;
  let auto = 0;
  let buf: string[] = [];

  const keyFor = (name: string) => {
    let k = slug(name);
    const b = k;
    let i = 2;
    while (vars[k]) k = b + '_' + i++;
    names[name] = k;
    return k;
  };
  const known = (name: string) => (names[name] && vars[names[name]] ? names[name] : null);

  /** Quita los prefijos ^ ~ @ (y * en grupos) del cuerpo. */
  function prefixes(body: string, allowMulti: boolean) {
    let multi = false, st = false, cap: boolean | null = null;
    const re = allowMulti ? /^[*@^~]/ : /^[@^~]/;
    while (re.test(body)) {
      const c = body[0];
      if (c === '*') multi = true;
      else if (c === '@') st = true;
      else cap = c === '^';
      body = body.slice(1).trimStart();
    }
    return { body, multi, st, cap };
  }

  function convertLine(line: string): string {
    let out = '';
    let last = 0;
    const RE = /\[([^[\]]+)\]|\{([^{}]+)\}/g;
    for (const m of line.matchAll(RE)) {
      out += line.slice(last, m.index);
      last = m.index! + m[0].length;
      const before = out.replace(/\*\*/g, '').trimEnd();
      const autoCap = before === '' || /[.!?]$/.test(before);
      const tok = (k: string, cap: boolean | null) => '{{' + k + ((cap ?? autoCap) ? '|cap' : '') + '}}';

      if (m[1] != null) {
        let raw = m[1].trim();
        let list = false;
        if (/^-\s/.test(raw)) { list = true; raw = raw.slice(1).trimStart(); }
        const p = prefixes(raw, true);
        let body = p.body;
        const multi = p.multi || list;

        if (body.startsWith('%')) {
          const nm = body.slice(1).trim() || 'anestésicos';
          const key = keyFor(nm);
          vars[key] = { label: nm, kind: 'la' };
          out += tok(key, p.cap);
          continue;
        }
        if (body.startsWith('?') && !body.startsWith('??')) {
          const qid = body.slice(1).trim().toLowerCase();
          const key = keyFor('q_' + qid);
          vars[key] = { label: QUESTS[qid]?.name ?? qid, kind: 'quest', qid };
          out += tok(key, p.cap);
          continue;
        }
        if (body.startsWith('#')) {
          const nm = body.slice(1).trim() || 'opioides';
          const k0 = known(nm);
          if (k0) { out += tok(k0, p.cap); continue; }
          const key = keyFor(nm);
          vars[key] = { label: nm, kind: 'opioid' };
          out += tok(key, p.cap);
          continue;
        }

        let name: string | null = null;
        const nm = body.match(NAME_RE);
        if (nm) { name = nm[1].trim(); body = body.slice(nm[0].length); }

        let groupHint: string | undefined;
        const opts: Option[] = [];
        for (let seg of body.split(/\s+\/\s+/).map((s) => s.trim()).filter(Boolean)) {
          if (seg.startsWith('??')) { groupHint = seg.slice(2).trim(); continue; }
          let hint: string | undefined;
          const hm = seg.match(/^(.*?)\s*\(\?\s+(.*)\)$/s);
          if (hm) { seg = hm[1]; hint = hm[2].trim(); }
          seg = seg.replace(/\{([^{}]+)\}/g, (_, fb: string) => {
            let f = fb.trim(), fst = false, fdef: string | null = null;
            if (f.startsWith('@')) { fst = true; f = f.slice(1).trim(); }
            const q = f.indexOf('=');
            if (q >= 0) { fdef = f.slice(q + 1).trim(); f = f.slice(0, q).trim(); }
            let fk = known(f);
            if (!fk) {
              fk = keyFor(f);
              const fd: VarDef = { label: f, kind: 'text', inOpt: true };
              if (fdef) applyDefault(fd, fdef);
              vars[fk] = fd;
              if (fst) sticky.push(fk);
            }
            return '⟦' + fk + '⟧';
          });
          let ex = false;
          if (multi && /^0\s+\S/.test(seg)) { ex = true; seg = seg.replace(/^0\s+/, ''); }
          const o: Option = seg.startsWith('!') ? { v: seg.slice(1).trim(), warn: true, hint: WARN_HINT } : { v: seg };
          if (hint) o.hint = hint;
          if (ex) o.ex = true;
          opts.push(o);
        }
        if (!opts.length) { out += m[0]; continue; }
        if (name) {
          const k0 = known(name);
          if (k0) { out += tok(k0, p.cap); continue; }
        }
        let key: string;
        if (name) key = keyFor(name);
        else { do { key = 'op' + ++auto; } while (vars[key]); }
        const d: VarDef = {
          label: name || autoLabel(opts),
          kind: multi ? 'multi' : 'choice',
          options: opts,
        };
        if (list) d.list = true;
        if (!name) d.auto = true;
        if (groupHint) d.hint = groupHint;
        vars[key] = d;
        if (p.st) sticky.push(key);
        out += tok(key, p.cap);
      } else {
        const p = prefixes(m[2].trim(), false);
        let body = p.body;
        let def: string | null = null;
        const eq = body.indexOf('=');
        if (eq >= 0) { def = body.slice(eq + 1).trim(); body = body.slice(0, eq).trim(); }
        if (!body) { out += m[0]; continue; }
        const k0 = known(body);
        if (k0) { out += tok(k0, p.cap); continue; }
        const key = keyFor(body);
        const d: VarDef = { label: body, kind: 'text' };
        if (def) applyDefault(d, def);
        vars[key] = d;
        if (p.st) sticky.push(key);
        out += tok(key, p.cap);
      }
    }
    return out + line.slice(last);
  }

  const flush = () => {
    if (!buf.length) return;
    if (!sec) { sec = { id: 's0', title: 'Nota', on: true, blocks: [] }; sections.push(sec); }
    sec.blocks.push(buf.join('\n'));
    buf = [];
  };

  for (const raw of String(source || '').replace(/\r/g, '').split('\n')) {
    const h = raw.match(/^##\s+(.*)$/);
    if (h) {
      flush();
      let title = h[1].trim();
      let hidden = false;
      const hm = title.match(/\((oculta|hidden)\)\s*$/i);
      if (hm) { hidden = true; title = title.slice(0, hm.index).trim(); }
      sec = { id: 's' + sections.length, title: title || 'Sección', on: !hidden, blocks: [] };
      sections.push(sec);
      continue;
    }
    if (!raw.trim()) { flush(); continue; }
    buf.push(convertLine(raw));
  }
  flush();

  return {
    id: meta.id,
    name: meta.name || 'Sin nombre',
    short: (meta.short || '').toUpperCase(),
    group: meta.group || 'Mis plantillas',
    lang: meta.lang || 'es',
    use: meta.use || 'nota',
    insMode: meta.insert || 'seccion',
    title: (meta.title || '').trim(),
    normal: !!meta.normal,
    sticky,
    vars,
    sections,
    textOnly: !Object.keys(vars).length,
    source,
  };
}

/* ---------------- archivos .md con encabezado ---------------- */

const META_KEYS = ['id', 'name', 'short', 'group', 'lang', 'use', 'insert', 'title', 'normal', 'order'] as const;

/** Lee un archivo de plantilla: encabezado `---` con clave: valor y luego la fuente. */
export function parseTemplateFile(text: string): { meta: TemplateMeta; source: string } {
  const m = text.replace(/\r/g, '').match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error('La plantilla no tiene encabezado ---');
  const meta: Record<string, unknown> = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const k = line.slice(0, i).trim(), v = line.slice(i + 1).trim();
    if ((META_KEYS as readonly string[]).includes(k)) meta[k] = k === 'normal' ? v === 'true' : k === 'order' ? Number(v) : v;
  }
  if (!meta.id || !meta.name) throw new Error('La plantilla necesita id y name');
  return { meta: meta as unknown as TemplateMeta, source: m[2] };
}

export function serializeTemplateFile(meta: TemplateMeta, source: string): string {
  const lines = ['---'];
  for (const k of META_KEYS) {
    const v = meta[k];
    if (v === undefined || v === '' || v === false) continue;
    lines.push(`${k}: ${v}`);
  }
  lines.push('---', '');
  return lines.join('\n') + source;
}
