/**
 * Template values: `{{path}}` and `{{path | filter | filter:arg}}`. Paths are dotted, resolved
 * against the current scope first, then the root data. `this` is the current scope, `@index`
 * the position in an `each`. Missing values print as empty strings.
 */
export interface Scope {
  root: unknown;
  current: unknown;
  index?: number;
}

export type Filter = (value: unknown, arg?: string) => unknown;

export const filters: Record<string, Filter> = {
  upper: (v) => String(v ?? '').toUpperCase(),
  lower: (v) => String(v ?? '').toLowerCase(),
  trim: (v) => String(v ?? '').trim(),
  money: (v, arg) => {
    const n = Number(v);
    if (!isFinite(n)) return '';
    const s = Math.abs(n).toFixed(2);
    return `${n < 0 ? '-' : ''}${arg ?? ''}${s}`;
  },
  fixed: (v, arg) => {
    const n = Number(v);
    return isFinite(n) ? n.toFixed(Number(arg ?? 2)) : '';
  },
  pad: (v, arg) => String(v ?? '').padStart(Number(arg ?? 0)),
  padEnd: (v, arg) => String(v ?? '').padEnd(Number(arg ?? 0)),
  default: (v, arg) => (v === undefined || v === null || v === '' ? arg ?? '' : v),
  date: (v, arg) => {
    const d = v instanceof Date ? v : new Date(String(v));
    if (isNaN(d.getTime())) return '';
    return arg === 'time' ? d.toLocaleTimeString() : arg === 'datetime' ? d.toLocaleString() : d.toLocaleDateString();
  },
  count: (v) => (Array.isArray(v) ? v.length : 0),
};

export function lookup(path: string, scope: Scope): unknown {
  const p = path.trim();
  if (p === 'this') return scope.current;
  if (p === '@index') return scope.index;
  if (p === '@number') return scope.index === undefined ? undefined : scope.index + 1;
  if (/^-?\d+(\.\d+)?$/.test(p)) return Number(p);
  if (/^'.*'$/.test(p) || /^".*"$/.test(p)) return p.slice(1, -1);
  const fromCurrent = walk(scope.current, p);
  if (fromCurrent !== undefined) return fromCurrent;
  return walk(scope.root, p);
}

function walk(obj: unknown, path: string): unknown {
  let cur: any = obj;
  for (const part of path.split('.')) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[part];
  }
  return cur;
}

export function evaluate(expression: string, scope: Scope): unknown {
  const [head, ...pipes] = expression.split('|').map((s) => s.trim());
  let value = lookup(head, scope);
  for (const pipe of pipes) {
    const idx = pipe.indexOf(':');
    const name = idx === -1 ? pipe : pipe.slice(0, idx);
    const arg = idx === -1 ? undefined : pipe.slice(idx + 1);
    const f = filters[name];
    if (!f) throw new Error(`retail-print-kit: unknown template filter "${name}"`);
    value = f(value, arg);
  }
  return value;
}

export function interpolate(text: string, scope: Scope): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_, expr) => {
    const v = evaluate(expr, scope);
    return v === undefined || v === null ? '' : String(v);
  });
}

export function truthy(expression: string, scope: Scope): boolean {
  const not = expression.trim().startsWith('!');
  const v = evaluate(not ? expression.trim().slice(1) : expression, scope);
  const t = Array.isArray(v) ? v.length > 0 : !!v;
  return not ? !t : t;
}
