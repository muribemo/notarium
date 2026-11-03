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

test('TFESI: elegir, escribir y copiar sin pendientes', async ({ page }) => {
  await start(page);
  await openTpl(page, 'TFESI');
  await page.locator('.grp[data-gk="side"] .opt', { hasText: 'Right' }).click();
  await page.locator('.grp[data-gk="level"] .opt', { hasText: 'L4-L5' }).click();
  await page.locator('.fld[data-key="duration"]').fill('6-month');
  await expect(page.locator('.fld[placeholder="Physician"]')).toHaveValue('Dr. Prueba (Lic. 999)');
  await page.locator('.botbar .primary:visible, .bar .btn.primary:visible').first().click();
  await expect(page.getByRole('dialog')).toContainText('sin elegir');
  await page.getByRole('button', { name: 'Copiar sin esas frases' }).click();
  await expect(page.locator('.toast')).toContainText(/copiada/i);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('Right L4-L5 transforaminal');
  expect(clip).toContain('6-month history');
  expect(clip).not.toContain('[');
});

test('advertencia clínica al elegir esteroide particulado', async ({ page }) => {
  await start(page);
  await openTpl(page, 'TFESI');
  await page.locator('.grp[data-gk="steroid"] .cpt').click();
  await page.locator('.pop .opt', { hasText: 'triamcinolone' }).click();
  await expect(page.locator('.hint.warn')).toContainText('NO usar en transforaminal');
});

test('paciente nuevo borra todo y se puede deshacer', async ({ page }) => {
  await start(page);
  await openTpl(page, 'TFESI');
  await page.locator('.fld[data-key="duration"]').fill('dato del paciente A');
  await page.reload();
  await expect(page.locator('.fld[data-key="duration"]')).toHaveValue('dato del paciente A');
  await page.keyboard.press('Alt+p');
  await expect(page.locator('.fld[data-key="duration"]')).toHaveValue('');
  await page.getByRole('button', { name: 'Deshacer' }).last().click();
  await expect(page.locator('.fld[data-key="duration"]')).toHaveValue('dato del paciente A');
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
