import { Logger } from '../../shared/Logger';

describe('Logger', () => {
  it('redacts registered secrets before writing logs', () => {
    const lines: string[] = [];
    const logger = new Logger({ write: line => lines.push(line) }, 'debug', () => '2026-06-23T00:00:00.000Z');

    logger.registerSecret('super-secret');
    logger.info('connecting with super-secret');

    expect(lines[0]).toContain('[INFO]');
    expect(lines[0]).toContain('[REDACTED]');
    expect(lines[0]).not.toContain('super-secret');
  });

  it('does not write info messages when configured for errors only', () => {
    const lines: string[] = [];
    const logger = new Logger({ write: line => lines.push(line) }, 'error', () => '2026-06-23T00:00:00.000Z');

    logger.info('not important');

    expect(lines).toEqual([]);
  });
});
