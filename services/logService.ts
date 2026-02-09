
export type LogLevel = 'info' | 'success' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  level: LogLevel;
}

type LogListener = (log: LogEntry) => void;
const listeners: LogListener[] = [];

export const addLogListener = (fn: LogListener) => {
  listeners.push(fn);
  return () => {
    const idx = listeners.indexOf(fn);
    if (idx > -1) listeners.splice(idx, 1);
  };
};

export const log = (message: string, level: LogLevel = 'info') => {
  const entry: LogEntry = {
    id: Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toLocaleTimeString(),
    message,
    level,
  };
  console.log(`[${entry.level.toUpperCase()}] ${message}`);
  listeners.forEach(fn => fn(entry));
};
