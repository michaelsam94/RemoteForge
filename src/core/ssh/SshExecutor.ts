import { Client, ConnectConfig } from 'ssh2';
import { SshConnectConfig } from './SshCredentials';

export interface RemoteExecResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface SshConnectionResult {
  ok: boolean;
  message: string;
}

export interface SshExecutorOptions {
  createClient?: () => Client;
  connectTimeoutMs?: number;
}

const defaultConnectTimeoutMs = 15000;

export async function testSshAuth(
  config: SshConnectConfig,
  options: SshExecutorOptions = {}
): Promise<SshConnectionResult> {
  try {
    await withConnectedClient(config, options, client => {
      void client;
      return Promise.resolve();
    });
    return { ok: true, message: `SSH authentication succeeded for ${config.username}@${config.host}:${config.port}` };
  } catch (error) {
    return { ok: false, message: messageFromError(error, config) };
  }
}

export async function execRemoteCommand(
  config: SshConnectConfig,
  command: string,
  cwd?: string,
  options: SshExecutorOptions = {}
): Promise<RemoteExecResult> {
  const remoteCommand = cwd ? `cd ${shellQuote(cwd)} && ${command}` : command;

  return withConnectedClient(config, options, client => new Promise((resolve, reject) => {
    client.exec(remoteCommand, (error, stream) => {
      if (error) {
        reject(error);
        return;
      }

      let stdout = '';
      let stderr = '';

      stream.on('data', (chunk: Buffer | string) => {
        stdout += String(chunk);
      });
      stream.stderr.on('data', (chunk: Buffer | string) => {
        stderr += String(chunk);
      });
      stream.on('close', (exitCode: number | null) => {
        resolve({ exitCode, stdout, stderr });
      });
      stream.on('error', reject);
    });
  }));
}

export async function withSshClient<T>(
  config: SshConnectConfig,
  options: SshExecutorOptions,
  run: (client: Client) => Promise<T>
): Promise<T> {
  return withConnectedClient(config, options, run);
}

async function withConnectedClient<T>(
  config: SshConnectConfig,
  options: SshExecutorOptions,
  run: (client: Client) => Promise<T>
): Promise<T> {
  const client = options.createClient?.() ?? new Client();
  const connectTimeoutMs = options.connectTimeoutMs ?? defaultConnectTimeoutMs;

  try {
    await connectClient(client, toConnectConfig(config), connectTimeoutMs);
    return await run(client);
  } finally {
    client.end();
  }
}

function connectClient(client: Client, config: ConnectConfig, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      client.end();
      reject(new Error(`Timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    const cleanup = (): void => {
      clearTimeout(timer);
      client.removeAllListeners('ready');
      client.removeAllListeners('error');
    };

    client.once('ready', () => {
      cleanup();
      resolve();
    });
    client.once('error', error => {
      cleanup();
      reject(error);
    });
    client.connect(config);
  });
}

function toConnectConfig(config: SshConnectConfig): ConnectConfig {
  const connectConfig: ConnectConfig = {
    host: config.host,
    port: config.port,
    username: config.username,
    readyTimeout: defaultConnectTimeoutMs
  };

  if (config.password) {
    connectConfig.password = config.password;
  }

  if (config.privateKey) {
    connectConfig.privateKey = config.privateKey;
  }

  if (config.passphrase) {
    connectConfig.passphrase = config.passphrase;
  }

  return connectConfig;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function messageFromError(error: unknown, config: SshConnectConfig): string {
  const detail = error instanceof Error ? error.message : String(error);
  return `SSH authentication failed for ${config.username}@${config.host}:${config.port}: ${detail}`;
}
