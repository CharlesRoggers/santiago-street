/**
 * Structured logging (§88). Categories are fixed so logs can be filtered.
 * Output is JSON lines in production, readable text in development.
 */
export type LogCategory =
  | "gameplay"
  | "net"
  | "ai"
  | "world"
  | "backend"
  | "auth"
  | "economy"
  | "persistence"
  | "perf"
  | "room";

const json = process.env.NODE_ENV === "production";

function emit(level: "info" | "warn" | "error", category: LogCategory, message: string, data?: unknown): void {
  const ts = new Date().toISOString();
  if (json) {
    console[level](JSON.stringify({ ts, level, category, message, ...(data ? { data } : {}) }));
  } else {
    console[level](`${ts} [${level.toUpperCase()}] [${category}] ${message}`, data ?? "");
  }
}

export const log = {
  info: (c: LogCategory, m: string, d?: unknown) => emit("info", c, m, d),
  warn: (c: LogCategory, m: string, d?: unknown) => emit("warn", c, m, d),
  error: (c: LogCategory, m: string, d?: unknown) => emit("error", c, m, d)
};
