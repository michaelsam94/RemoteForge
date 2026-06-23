import * as net from 'net';

export interface TcpTarget {
  host: string;
  port: number;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
}

export interface TcpConnectionOptions {
  connect?: (target: TcpTarget, timeoutMs: number) => Promise<void>;
  timeoutMs?: number;
}

export async function testTcpConnection(
  target: TcpTarget,
  options: TcpConnectionOptions = {}
): Promise<ConnectionTestResult> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const connect = options.connect ?? connectWithSocket;

  try {
    await connect(target, timeoutMs);
    return { ok: true, message: `Reached ${target.host}:${target.port}` };
  } catch (error) {
    return { ok: false, message: `Could not reach ${target.host}:${target.port}: ${messageFromError(error)}` };
  }
}

function connectWithSocket(target: TcpTarget, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: target.host, port: target.port });

    const cleanup = (): void => {
      socket.removeAllListeners();
      socket.destroy();
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      cleanup();
      resolve();
    });
    socket.once('timeout', () => {
      cleanup();
      reject(new Error('Timed out'));
    });
    socket.once('error', error => {
      cleanup();
      reject(error);
    });
  });
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
