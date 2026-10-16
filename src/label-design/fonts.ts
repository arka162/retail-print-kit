export const LABEL_FONT_FILES: [family: string, file: string, weight: string, style: string][] = [
  ['Arimo', 'arimo-400.woff2', '400', 'normal'],
  ['Arimo', 'arimo-700.woff2', '700', 'normal'],
  ['Arimo', 'arimo-400-italic.woff2', '400', 'italic'],
  ['Archivo Narrow', 'archivo-narrow-400.woff2', '400', 'normal'],
  ['Archivo Narrow', 'archivo-narrow-700.woff2', '700', 'normal'],
  ['Oswald', 'oswald-500.woff2', '500', 'normal'],
  ['Oswald', 'oswald-700.woff2', '700', 'normal'],
  ['Roboto Slab', 'roboto-slab-400.woff2', '400', 'normal'],
  ['Roboto Slab', 'roboto-slab-700.woff2', '700', 'normal']
];

const loading = new Map<string, Promise<void>>();

/**
 * Loads the bundled label fonts in a browser from `baseUrl` (where the app serves
 * `retail-print-kit/dist/label-fonts/`). Missing fonts fall back to the system font; outside a browser it does nothing.
 */
export function ensureLabelFonts(baseUrl = 'assets/label-fonts/'): Promise<void> {
  const g = globalThis as any;
  if (typeof g.FontFace !== 'function' || !g.document || !g.document.fonts) return Promise.resolve();
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const hit = loading.get(base);
  if (hit) return hit;
  const ready = Promise.all(LABEL_FONT_FILES.map(([family, file, weight, style]) => {
    const face = new g.FontFace(family, `url(${base}${file})`, { weight, style });
    return face.load().then((loaded: any) => { g.document.fonts.add(loaded); }, () => undefined);
  })).then(() => undefined);
  loading.set(base, ready);
  return ready;
}
