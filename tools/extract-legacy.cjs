// Extrae las plantillas del prototipo (legacy/notarium-v40-pruebas.html) a archivos .md
// y genera textos de referencia ("golden") con el motor original para validar el motor nuevo.
// Uso: node tools/extract-legacy.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LEGACY = path.join(ROOT, 'legacy/notarium-v40-pruebas.html');
const OUT = path.join(ROOT, 'content/templates');
const GOLDEN = path.join(ROOT, 'src/engine/__fixtures__/golden.json');

const GROUP_DIR = {
  'Dolor intervencionista': 'dolor-intervencionista',
  'Anestesia': 'anestesia',
  'Ronda dolor y paliativos': 'ronda-dolor-paliativos',
  'Examen físico por región': 'examen-fisico',
  'Cuestionarios': 'cuestionarios',
  'Consulta e historia clínica': 'consulta',
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('pageerror', e.message));
  await page.goto('file://' + LEGACY);

  const data = await page.evaluate(() => {
    /* ---------- exportador: como builtinToSource, pero conserva las pistas ---------- */
    function toSource(t) {
      const seen = new Set(), used = new Set(), nameOf = {}, out = [];
      const nm = (k, d) => {
        if (nameOf[k]) return nameOf[k];
        let n = d.label;
        const ok = d.kind === 'text' ? !/[{}=]/.test(n) : NAME_RE.test(n + ': ');
        if (!ok || used.has(n)) n = k;
        used.add(n); nameOf[k] = n; return n;
      };
      const field = (fk) => {
        const fd = t.vars[fk]; if (!fd) return '';
        seen.add(fk);
        return '{' + (t.sticky.includes(fk) ? '@' : '') + nm(fk, fd) + (fd.today ? '=hoy' : fd.def ? '=' + fd.def : '') + '}';
      };
      t.sections.forEach((s) => {
        out.push('## ' + s.title + (s.on === false ? ' (oculta)' : ''));
        s.blocks.forEach((b) => {
          out.push(b.replace(TOK, (_, k, c, off) => {
            const d = t.vars[k]; if (!d) return '';
            // el parser pone mayúscula si el token abre la línea o sigue a . ! ?; marcar solo si difiere
            const pre = b.slice(b.lastIndexOf('\n', off - 1) + 1, off).replace(/\*\*/g, '').trimEnd();
            const auto = pre === '' || /[.!?]$/.test(pre);
            const cm = !!c === auto ? '' : c ? '^' : '~';
            const n = nm(k, d), st = t.sticky.includes(k) ? '@' : '';
            if (seen.has(k)) return '{' + cm + n + '}';
            seen.add(k);
            if (d.kind === 'text') return '{' + cm + st + n + (d.today ? '=hoy' : d.def ? '=' + d.def : '') + '}';
            if (d.kind === 'opioid') return '[#' + n + ']';
            if (d.kind === 'la') return '[%' + n + ']';
            if (d.kind === 'quest') return '[?' + d.qid + ']';
            const opts = d.options.map((o) =>
              (o.ex ? '0 ' : '') + (o.warn ? '!' : '') +
              o.v.replace(/⟦(\w+)⟧/g, (_, fk) => field(fk)) +
              (o.hint && !(o.warn && o.hint === 'Opción marcada con advertencia en tu plantilla.') ? ' (? ' + o.hint + ')' : ''));
            if (d.hint) opts.push('?? ' + d.hint);
            // grupo sin nombre: la etiqueta es el inicio de sus opciones
            const unnamed = /^op\d+$/.test(k) && d.label === d.options.map((o) => o.v).join(' / ').slice(0, 48);
            return '[' + (d.kind === 'multi' ? (d.list ? '- ' : '*') : '') + cm + st + (unnamed ? '' : n + ': ') + opts.join(' / ') + ']';
          }));
          out.push('');
        });
      });
      return out.join('\n').trim() + '\n';
    }

    /* ---------- escenarios deterministas para los textos de referencia ---------- */
    const h = (s) => { let x = 0; for (const c of s) x = (x * 31 + c.codePointAt(0)) >>> 0; return x; };
    function scenario(t, kind) {
      const v = {};
      for (const [k, d] of Object.entries(t.vars)) {
        if (kind === 'empty') {
          if (d.def != null) v[k] = d.def;
          if (d.kind === 'multi') v[k] = [];
          continue;
        }
        if (d.kind === 'text') v[k] = d.inOpt ? 'YY' : 'XX';
        else if (d.kind === 'choice') { const o = d.options; v[k] = o[h(o.map((x) => x.v.replace(/⟦\w+⟧/g, '…')).join('|')) % o.length].v; }
        else if (d.kind === 'multi') {
          const o = d.options, idx = o.map((_, i) => i).filter((i) => !o[i].ex);
          if (!idx.length) v[k] = [o[0].v];
          else { const s = h(o.map((x) => x.v.replace(/⟦\w+⟧/g, '…')).join('|')); const a = idx[s % idx.length], b = idx[(s + 1) % idx.length]; v[k] = [...new Set([a, b])].sort((x, y) => x - y).map((i) => o[i].v); }
        }
        else if (d.kind === 'quest') { const q = QUESTS[d.qid]; const a = {}; q.items.forEach((it, i) => { a[i] = it.t === 'yn' ? 1 : it.t === 'num' ? Math.min(3, it.max) : it.o[it.o.length > 1 ? 1 : 0].v; }); v[k] = { a, open: true }; }
        else if (d.kind === 'opioid') v[k] = { rows: [{ o: 'mor_vo', d: '60', f: '1' }, { o: 'fen_td', d: '25', f: '2.4' }], tgt: 'oxi_vo', red: '30', res: '10' };
        else if (d.kind === 'la') v[k] = { peso: '70', rows: [{ a: 'ropi', c: '0.5', v: '20', e: false, m: '3' }, { a: 'lido', c: '2', v: '5', e: true, m: '7' }] };
      }
      return v;
    }
    const golden = {};
    const templates = TEMPLATES.map((t, order) => {
      golden[t.id] = {};
      for (const kind of ['empty', 'full']) {
        S.notes[t.id] = { values: scenario(t, kind), custom: {}, lit: {}, drop: {}, items: {} };
        golden[t.id][kind] = toText(t);
      }
      return {
        id: t.id, name: t.name, short: t.short || '', group: t.group, lang: t.lang,
        use: t.use, insMode: t.insMode, title: t.title || '', normal: !!t.normalBtn,
        source: toSource(t), order,
      };
    });
    return { templates, combos: BUILTIN_COMBOS, golden, version: APP_VERSION };
  });
  await browser.close();

  fs.rmSync(OUT, { recursive: true, force: true });
  for (const t of data.templates) {
    const dir = path.join(OUT, GROUP_DIR[t.group] || 'otros');
    fs.mkdirSync(dir, { recursive: true });
    const fm = ['---', `id: ${t.id}`, `name: ${t.name}`];
    if (t.short) fm.push(`short: ${t.short}`);
    fm.push(`group: ${t.group}`, `lang: ${t.lang}`, `use: ${t.use}`, `insert: ${t.insMode}`);
    if (t.title) fm.push(`title: ${t.title}`);
    if (t.normal) fm.push('normal: true');
    fm.push(`order: ${t.order}`);
    fm.push('---', '');
    fs.writeFileSync(path.join(dir, t.id + '.md'), fm.join('\n') + t.source);
  }
  const combos = data.combos.map(({ id, name, short, base, blocks }) => ({ id, name, short, base, blocks: blocks.map(({ sid, tpl }) => ({ section: sid, template: tpl })) }));
  fs.writeFileSync(path.join(ROOT, 'content/combos.json'), JSON.stringify(combos, null, 2) + '\n');
  fs.mkdirSync(path.dirname(GOLDEN), { recursive: true });
  fs.writeFileSync(GOLDEN, JSON.stringify(data.golden, null, 1) + '\n');
  console.log(`Exportadas ${data.templates.length} plantillas y ${combos.length} notas compuestas desde ${data.version}.`);
})();
