import { useSyncExternalStore } from "react";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogCategory =
  "compiler" | "store" | "validator" | "clipboard" | "assets" | "providers" | "ui";

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: unknown;
}

const MAX_LOGS = 500;
let entries: LogEntry[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

const uid = () => Math.random().toString(36).slice(2, 10);

export const logger = {
  log(level: LogLevel, category: LogCategory, message: string, details?: unknown) {
    const entry: LogEntry = {
      id: uid(),
      timestamp: Date.now(),
      level,
      category,
      message,
      details,
    };
    entries = [entry, ...entries.slice(0, MAX_LOGS - 1)];

    // Mirror to standard console for DevTools inspectability
    const prefix = `[${category.toUpperCase()}] ${message}`;
    if (level === "error") {
      console.error(prefix, details ?? "");
    } else if (level === "warn") {
      console.warn(prefix, details ?? "");
    } else if (level === "info") {
      console.info(prefix, details ?? "");
    } else {
      console.debug(prefix, details ?? "");
    }

    emit();
    return entry;
  },

  debug(category: LogCategory, message: string, details?: unknown) {
    return this.log("debug", category, message, details);
  },

  info(category: LogCategory, message: string, details?: unknown) {
    return this.log("info", category, message, details);
  },

  warn(category: LogCategory, message: string, details?: unknown) {
    return this.log("warn", category, message, details);
  },

  error(category: LogCategory, message: string, details?: unknown) {
    return this.log("error", category, message, details);
  },

  getLogs(filter?: {
    level?: LogLevel | undefined;
    category?: LogCategory | undefined;
    search?: string | undefined;
  }): LogEntry[] {
    let out = entries;
    if (filter?.level) {
      out = out.filter((e) => e.level === filter.level);
    }
    if (filter?.category) {
      out = out.filter((e) => e.category === filter.category);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      out = out.filter(
        (e) =>
          e.message.toLowerCase().includes(q) ||
          e.category.toLowerCase().includes(q) ||
          (e.details && JSON.stringify(e.details).toLowerCase().includes(q)),
      );
    }
    return out;
  },

  clear() {
    entries = [];
    emit();
  },

  exportLogsJson(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        totalEntries: entries.length,
        logs: entries,
      },
      null,
      2,
    );
  },

  exportLogsText(): string {
    return entries
      .map(
        (e) =>
          `[${new Date(e.timestamp).toISOString()}] [${e.level.toUpperCase()}] [${e.category.toUpperCase()}] ${e.message}${
            e.details !== undefined ? ` :: ${JSON.stringify(e.details)}` : ""
          }`,
      )
      .join("\n");
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useLogs(): LogEntry[] {
  return useSyncExternalStore(
    logger.subscribe,
    () => entries,
    () => entries,
  );
}
