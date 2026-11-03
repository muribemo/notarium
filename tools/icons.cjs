// Genera los íconos PNG de la PWA a partir de public/icon.svg (usa el Chromium preinstalado).
const { chromium } = require('playwright');
const fs = require('fs'); const path = require('path');
(async () => {
  const svg = fs.readFileSync(path.resolve(__dirname, '../public/icon.svg'), 'utf8');
  const b = await chromium.launch();
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    await p.setContent(`<html><body style="margin:0">${svg.replace('<svg ', `<svg width="${s}" height="${s}" `)}</body></html>`);
    await p.screenshot({ path: path.resolve(__dirname, `../public/icon-${s}.png`), omitBackground: true });
  }
  await b.close();
})();
