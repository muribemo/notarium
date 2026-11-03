/** Utilidades numéricas y de texto compartidas por las calculadoras. */

/** Convierte texto a número aceptando coma decimal; vacío o inválido = 0. */
export const num = (s: unknown): number => {
  const x = parseFloat(String(s == null ? '' : s).replace(',', '.'));
  return isFinite(x) ? x : 0;
};

/** Redondea a un decimal y usa formato colombiano (coma decimal). */
export const fmt = (x: number): string =>
  (Math.round(x * 10) / 10).toLocaleString('es-CO', { maximumFractionDigits: 1 });

export function joinList(arr: string[], lang: 'es' | 'en' = 'es'): string {
  if (arr.length < 2) return arr.join('');
  return arr.slice(0, -1).join(', ') + (lang === 'en' ? ' and ' : ' y ') + arr[arr.length - 1];
}

export const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
