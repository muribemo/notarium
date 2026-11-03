/**
 * Pasar la nota en curso de un dispositivo a otro (p. ej. del celular al computador) sin servidor:
 * la nota va comprimida dentro del enlace, después del # (esa parte no se envía a ningún servidor;
 * solo viaja por donde el usuario decida compartir el enlace).
 */
import type { NoteState } from '../engine/types';
import { allBlocks, currentTpl, toast, useApp } from './store';

export interface Bundle {
  v: 1;
  tplId: string;
  name: string;
  notes: Record<string, NoteState>;
  started: number | null;
  at: number;
}

const PREFIX = '#nota=';

async function pipe(bytes: BufferSource, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const s = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(s).arrayBuffer());
}
const toB64url = (b: Uint8Array) => {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

export async function encodeBundle(b: Bundle): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(b));
  return toB64url(await pipe(bytes, new CompressionStream('deflate-raw')));
}
export async function decodeBundle(s: string): Promise<Bundle | null> {
  try {
    const json = new TextDecoder().decode(await pipe(fromB64url(s), new DecompressionStream('deflate-raw')));
    const b = JSON.parse(json) as Bundle;
    return b && b.v === 1 && b.tplId && b.notes ? b : null;
  } catch {
    return null;
  }
}

/** La nota abierta (con sus bloques insertados) lista para viajar. */
export function currentBundle(): Bundle {
  const t = currentTpl(), s = useApp.getState(), notes: Record<string, NoteState> = {};
  for (const b of allBlocks(t)) if (s.notes[b.id]) notes[b.id] = s.notes[b.id];
  return { v: 1, tplId: t.id, name: t.name, notes, started: s.started, at: Date.now() };
}

export async function transferLink(): Promise<string> {
  const base = location.origin + location.pathname;
  return base + PREFIX + (await encodeBundle(currentBundle()));
}

/** Si la página se abrió con una nota en el enlace, la devuelve y limpia la dirección. */
export async function bundleFromLocation(): Promise<Bundle | null> {
  if (!location.hash.startsWith(PREFIX)) return null;
  const b = await decodeBundle(location.hash.slice(PREFIX.length));
  history.replaceState(null, '', location.pathname + location.search);
  if (!b) toast('El enlace de la nota está incompleto o dañado.', true);
  return b;
}

export function openBundle(b: Bundle) {
  const s = useApp.getState();
  if (!s.catalog.byId.has(b.tplId)) {
    toast('Esta nota usa una plantilla que no existe en este dispositivo. Importa tu respaldo primero.', true);
    return false;
  }
  // el estado anterior queda en el historial para poder deshacer
  useApp.setState({ hist: { u: [...s.hist.u, { notes: s.notes, vis: s.settings.vis, started: s.started }], r: [] } });
  useApp.setState({ notes: { ...b.notes }, tplId: b.tplId, started: b.started ?? b.at, view: 'note', modal: null });
  toast('Nota recibida. Sigue donde la dejaste.');
  return true;
}
