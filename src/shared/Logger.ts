export interface LogSink {
  write(line: string): void;
}

export type LogLevel = 'off' | 'error' | 'warn' | 'info' | 'debug';

const levels: Record<Exclude<LogLevel, 'off'>, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

export class Logger {
  private readonly secrets = new Set<string>();

  constructor(
    private readonly sink: LogSink,
    private readonly level: LogLevel = 'info',
    private readonly now: () => string = () => new Date().toISOString()
  ) {}

  registerSecret(value: string): void {
    if (value.length > 0) {
      this.secrets.add(value);
    }
  }

  error(message: string): void {
    this.write('error', message);
  }

  warn(message: string): void {
    this.write('warn', message);
  }

  info(message: string): void {
    this.write('info', message);
  }

  debug(message: string): void {
    this.write('debug', message);
  }

  private write(level: Exclude<LogLevel, 'off'>, message: string): void {
    if (!this.shouldWrite(level)) {
      return;
    }

    this.sink.write(`[${this.now()}] [${level.toUpperCase()}] ${this.redact(message)}`);
  }

  private shouldWrite(level: Exclude<LogLevel, 'off'>): boolean {
    return this.level !== 'off' && levels[level] <= levels[this.level];
  }

  private redact(message: string): string {
    let redacted = message;

    for (const secret of this.secrets) {
      redacted = redacted.split(secret).join('[REDACTED]');
    }

    return redacted;
  }
}
