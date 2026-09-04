/**
 * Localization (§86). Spanish first; English/Portuguese to follow.
 * No user-facing string may be hardcoded outside these tables.
 */
import es from "./es.json";
import en from "./en.json";

type Table = Record<string, string>;
const TABLES: Record<string, Table> = { es, en };

let current: Table = es;

export function setLocale(code: string): void {
  current = TABLES[code] ?? es;
}

export function detectLocale(): string {
  const nav = typeof navigator !== "undefined" ? navigator.language : "es";
  const short = nav.slice(0, 2).toLowerCase();
  return short in TABLES ? short : "es";
}

export function t(key: string, vars?: Record<string, string | number>): string {
  let s = current[key] ?? es[key as keyof typeof es] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}
