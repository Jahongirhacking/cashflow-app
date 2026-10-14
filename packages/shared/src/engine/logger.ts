// The shared package compiles without DOM/Node libs; declare the console surface it uses.
declare const console: {
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
};

/** Minimal logger the engine writes to; the API adapts Nest's Logger, the app uses the console. */
export interface Logger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string, trace?: string): void;
}

export const noopLogger: Logger = {
  log: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export function consoleLogger(name: string): Logger {
  return {
    log: (m) => console.log(`[${name}] ${m}`),
    warn: (m) => console.warn(`[${name}] ${m}`),
    error: (m, trace) => console.error(`[${name}] ${m}`, trace ?? ''),
  };
}
