/** Recorridos clínicos completos en el navegador (escritorio y celular). */
import { expect, test, type Page } from '@playwright/test';

async function start(page: Page, name = 'Dr. Prueba', reg = '999') {
  await page.goto('/');
  const dlg = page.getByRole('dialog');
  await dlg.locator('input').nth(0).fill(name);
  await dlg.locator('input').nth(1).fill(reg);
  await page.getByRole('button', { name: 'Empezar' }).click();
}
const openTpl = async (page: Page, code: string) => {
  if (await page.locator('.bar .btn.mob').isVisible()) await page.locator('.bar .btn.mob').click();
  await page.locator('.tpl-row .code', { hasText: new RegExp(`^${code.replace(/[+]/g, '\\+')}$`) }).click();
};

test('TFESI en español: elegir, escribir y copiar sin pendientes', async ({ page }) => {
  await start(page);
  await openTpl(page, 'TFESI');
  await expect(page.locator('.bar h1')).toHaveText('Epidural transforaminal lumbar');
  await page.locator('.grp[data-gk="lado"] .opt', { hasText: 'derecho' }).click();
  await page.locator('.grp[data-gk="nivel"] .opt', { hasText: 'L4-L5' }).click();
  await page.locator('.fld[data-key="tiempo_de_evolucion"]').fill('6 meses');
  await expect(page.locator('.fld[placeholder="médico"]')).toHaveValue('Dr. Prueba (RM 999)');
  await page.locator('.botbar .primary:visible, .bar .btn.primary:visible').first().click();
  await expect(page.getByRole('dialog')).toContainText('sin elegir');
  await page.getByRole('button', { name: 'Copiar sin esas frases' }).click();
  await expect(page.locator('.toast')).toContainText(/copiada/i);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('Inyección epidural transforaminal de esteroide en L4-L5 derecho');
  expect(clip).toContain('miembro inferior derecho de 6 meses de evolución');
  expect(clip).not.toContain('[');
});

test('advertencia clínica al elegir esteroide particulado', async ({ page }) => {
  await start(page);
  await openTpl(page, 'TFESI');
  await page.locator('.grp[data-gk="esteroide"] .cpt').click();
  await page.locator('.pop .opt', { hasText: 'triamcinolona' }).click();
  await expect(page.locator('.hint.warn')).toContainText('NO usar en transforaminal');
});

test('paciente nuevo borra todo y se puede deshacer', async ({ page }) => {
  await start(page);
  await openTpl(page, 'TFESI');
  const f = page.locator('.fld[data-key="tiempo_de_evolucion"]');
  await f.fill('dato del paciente A');
  await page.reload();
  await expect(f).toHaveValue('dato del paciente A');
  await page.keyboard.press('Alt+p');
  await expect(f).toHaveValue('');
  await page.getByRole('button', { name: 'Deshacer' }).last().click();
  await expect(f).toHaveValue('dato del paciente A');
});

test('nota libre con bloques, examen normal y cuestionario', async ({ page }) => {
  await start(page);
  await page.goto('/');
  await page.keyboard.press('Alt+n');
  await page.getByRole('button', { name: '+ Insertar bloque' }).first().click();
  await page.getByPlaceholder('Buscar bloque para insertar…').fill('hombro');
  await page.keyboard.press('Enter');
  await page.locator('.ins').getByRole('button', { name: 'Todo normal' }).click();
  await page.getByRole('button', { name: '+ Insertar bloque' }).last().click();
  await page.getByPlaceholder('Buscar bloque para insertar…').fill('dn4');
  await page.keyboard.press('Enter');
  await page.locator('.qz-it').first().getByRole('button', { name: 'Sí' }).click();
  await page.locator('.botbar .primary:visible, .bar .btn.primary:visible').first().click();
  // si "Todo normal" completó todo, se copia directo; si quedó algo, se copia sin lo pendiente
  const omit = page.getByRole('button', { name: 'Copiar sin esas frases' });
  await expect(omit.or(page.locator('.toast', { hasText: /copiada/i }))).toBeVisible();
  if (await omit.isVisible()) await omit.click();
  await expect(page.locator('.toast')).toContainText(/copiada/i);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('Hombro derecho');
  expect(clip).toContain('DN4 1/10');
});

test('sin desplazamiento horizontal y sin ** visibles', async ({ page }) => {
  await start(page);
  await openTpl(page, 'RONDA+');
  const w = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(w[0]).toBeLessThanOrEqual(w[1]);
  expect(await page.locator('#sheet p', { hasText: '**' }).count()).toBe(0);
});

test('copiar solo una sección', async ({ page }) => {
  await start(page);
  await openTpl(page, 'TFESI');
  await page.locator('.grp[data-gk="lado"] .opt', { hasText: 'izquierdo' }).click();
  await page.locator('.grp[data-gk="nivel"] .opt', { hasText: 'L3-L4' }).click();
  await page.locator('section', { hasText: 'Indicación' }).first().getByRole('button', { name: 'Copiar', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Copiado: Indicación');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('transforaminal de esteroide en L3-L4 izquierdo');
  expect(clip).not.toContain('Técnica:');
});

test('enviar la nota a otro dispositivo y seguirla allí', async ({ page, browser }) => {
  await start(page);
  await openTpl(page, 'TFESI');
  await page.locator('.grp[data-gk="lado"] .opt', { hasText: 'derecho' }).click();
  await page.locator('.fld[data-key="tiempo_de_evolucion"]').fill('3 meses');
  await page.evaluate(() => { (navigator as unknown as { share?: unknown }).share = undefined; });
  if (await page.locator('.botbar').isVisible()) await page.locator('.botbar').getByRole('button', { name: /Enviar/ }).click();
  else { await page.getByRole('button', { name: 'Más opciones' }).click(); await page.getByRole('menuitem', { name: /otro dispositivo/ }).click(); }
  await page.getByRole('button', { name: /Copiar enlace|Compartir enlace/ }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toContain('#nota=');
  // "otro dispositivo": un navegador nuevo, sin nada guardado
  const other = await browser.newPage();
  await other.goto(link);
  await expect(other.getByRole('dialog')).toContainText('Llegó una nota');
  await other.getByRole('button', { name: 'Abrir y seguir' }).click();
  await expect(other.locator('.fld[data-key="tiempo_de_evolucion"]')).toHaveValue('3 meses');
  await expect(other.locator('.grp[data-gk="lado"] .opt.sel')).toHaveText('derecho');
  expect(other.url()).not.toContain('#nota=');
});

test('menú ⋯ de un grupo: borrar la elección', async ({ page }) => {
  await start(page);
  await openTpl(page, 'TFESI');
  const g = page.locator('.grp[data-gk="lado"]');
  await g.locator('.opt', { hasText: 'derecho' }).click();
  await g.locator('.gm-btn').click();
  await page.getByRole('menuitem', { name: 'Borrar elección' }).click();
  await expect(g).not.toHaveClass(/chosen/);
});
