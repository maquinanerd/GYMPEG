// Structured server logs (G3). One JSON object per line in production (or
// with LOG_FORMAT=json), readable lines in development. Fields whose names
// look sensitive (credentials, contact, health data) are redacted at any depth,
// so a careless `log.error('x', { body })` cannot leak them; errors become
// { name, message, code, stack }.

type Level = 'debug' | 'info' | 'warn' | 'error';
type Fields = Record<string, unknown>;

const SENSITIVE_KEY =
  /pass(word)?|token|secret|authorization|cookie|session|e-?mail|weight|bodyweight|measurement|photo|note|answer|prompt/i;
const MAX_DEPTH = 4;
const MAX_STACK = 2000;

function serialize(value: unknown, depth: number): unknown {
  if (value instanceof Error) {
    const code = (value as { code?: unknown }).code;
    return {
      name: value.name,
      message: value.message,
      ...(code !== undefined ? { code } : {}),
      ...(value.stack ? { stack: value.stack.slice(0, MAX_STACK) } : {}),
    };
  }
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[truncated]';
  if (Array.isArray(value)) return value.map((item) => serialize(item, depth + 1));
  if (value instanceof Date) return value.toISOString();
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SENSITIVE_KEY.test(key) ? '[redacted]' : serialize(item, depth + 1),
    ]),
  );
}

export function redactFields(fields: Fields): Fields {
  return serialize(fields, 0) as Fields;
}

function jsonOutput(): boolean {
  return process.env.LOG_FORMAT === 'json' || process.env.NODE_ENV === 'production';
}

function write(level: Level, event: string, fields: Fields = {}): void {
  const safe = redactFields(fields);
  if (jsonOutput()) {
    const line = JSON.stringify({ time: new Date().toISOString(), level, event, ...safe });
    (level === 'error' || level === 'warn' ? process.stderr : process.stdout).write(`${line}\n`);
    return;
  }
  const method = level === 'debug' ? 'log' : level;
  console[method](`[${event}]`, ...(Object.keys(safe).length ? [safe] : []));
}

export const log = {
  debug: (event: string, fields?: Fields) => write('debug', event, fields),
  info: (event: string, fields?: Fields) => write('info', event, fields),
  warn: (event: string, fields?: Fields) => write('warn', event, fields),
  error: (event: string, fields?: Fields) => write('error', event, fields),
};
