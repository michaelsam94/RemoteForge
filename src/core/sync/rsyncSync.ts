import { execFile, spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { SshConnectConfig } from '../ssh/SshCredentials';
import { withSshClient } from '../ssh/SshExecutor';
import { WorkspaceFileEntry } from './collectWorkspaceFiles';
import { formatRsyncLocalPath, isCommandAvailable, isWindowsPlatform, nullDevicePath } from './syncPlatform';
import { buildTarExcludeArgs } from './syncExcludes';
import { SyncProgress, SyncResult } from './sftpOperations';

const execFileAsync = promisify(execFile);

export interface RsyncSyncOptions {
  onProgress?: (progress: SyncProgress) => void;
}

export interface RsyncCapabilities {
  available: boolean;
  supportsProgress2: boolean;
  skipReason?: string;
}

interface RsyncAuthSetup {
  command: string;
  prefixArgs: string[];
  sshCommand: string;
  env: NodeJS.ProcessEnv;
  cleanup: () => Promise<void>;
}

export async function getRsyncCapabilities(): Promise<RsyncCapabilities> {
  const rsyncAvailable = await isCommandAvailable('rsync');
  if (!rsyncAvailable) {
    return {
      available: false,
      supportsProgress2: false,
      skipReason: isWindowsPlatform()
        ? 'Rsync is not installed on Windows — using archive upload instead.'
        : 'Rsync is not available — using archive upload instead.'
    };
  }

  if (isWindowsPlatform() && !(await isCommandAvailable('ssh'))) {
    return {
      available: false,
      supportsProgress2: false,
      skipReason: 'OpenSSH client (ssh) is required for rsync on Windows — using archive upload instead.'
    };
  }

  try {
    const { stdout } = await execFileAsync('rsync', ['--version']);
    const versionMatch = stdout.match(/rsync\s+version\s+(\d+)/i);
    const majorVersion = versionMatch ? Number.parseInt(versionMatch[1], 10) : 0;
    return {
      available: true,
      supportsProgress2: majorVersion >= 3
    };
  } catch {
    return {
      available: false,
      supportsProgress2: false,
      skipReason: isWindowsPlatform()
        ? 'Rsync is installed but could not be started on Windows — using archive upload instead.'
        : 'Rsync is installed but could not be started — using archive upload instead.'
    };
  }
}

export function buildRsyncExcludeArgs(excludePatterns: string[]): string[] {
  return buildTarExcludeArgs(excludePatterns);
}

export function parseRsyncProgressPercent(line: string): number | undefined {
  const progress2Match = line.match(/\s(\d{1,3})%\s/);
  if (progress2Match) {
    return Math.min(100, Number.parseInt(progress2Match[1], 10));
  }

  const progressMatch = line.match(/(\d{1,3})%/);
  if (progressMatch) {
    return Math.min(100, Number.parseInt(progressMatch[1], 10));
  }

  return undefined;
}

export async function syncWorkspaceViaRsync(
  config: SshConnectConfig,
  workspaceRoot: string,
  remoteRoot: string,
  excludePatterns: string[],
  files: WorkspaceFileEntry[],
  options: RsyncSyncOptions = {}
): Promise<SyncResult> {
  const capabilities = await getRsyncCapabilities();
  if (!capabilities.available) {
    throw new Error('rsync is not installed or not available on PATH');
  }

  await ensureRemoteDirectory(config, remoteRoot);

  const auth = await prepareRsyncAuth(config);
  const source = formatRsyncLocalPath(workspaceRoot, path.resolve);
  const destination = `${config.username}@${config.host}:${remoteRoot.replace(/\/+$/, '')}/`;

  try {
    reportProgress(options, 0, `Syncing ${files.length} files with rsync`);
    await runRsync(auth, capabilities, excludePatterns, source, destination, percent => {
      reportProgress(options, percent, `Syncing with rsync (${percent}%)`);
    });
    reportProgress(options, 100, `Migration complete (${files.length} files)`);
    return { uploaded: files.length, downloaded: 0, skipped: 0 };
  } finally {
    await auth.cleanup();
  }
}

async function ensureRemoteDirectory(config: SshConnectConfig, remoteRoot: string): Promise<void> {
  await withSshClient(config, { connectTimeoutMs: 30000 }, async client => {
    await new Promise<void>((resolve, reject) => {
      client.exec(`mkdir -p ${shellQuote(remoteRoot)}`, (error, stream) => {
        if (error) {
          reject(error);
          return;
        }

        stream.on('close', () => resolve());
        stream.on('error', reject);
      });
    });
  });
}

async function prepareRsyncAuth(config: SshConnectConfig): Promise<RsyncAuthSetup> {
  const cleanupTasks: Array<() => Promise<void>> = [];
  const env: NodeJS.ProcessEnv = { ...process.env };
  const sshArgs = [
    '-p',
    String(config.port),
    '-o',
    'StrictHostKeyChecking=accept-new',
    '-o',
    `UserKnownHostsFile=${nullDevicePath()}`,
    '-o',
    'LogLevel=ERROR'
  ];

  if (config.privateKey) {
    const keyPath = path.join(os.tmpdir(), `remoteforge-key-${crypto.randomUUID()}`);
    await fs.promises.writeFile(keyPath, config.privateKey, { mode: 0o600 });
    cleanupTasks.push(async () => removeFileIfExists(keyPath));
    sshArgs.push('-i', keyPath);

    if (config.passphrase) {
      const askPass = await createAskPassHelper(config.passphrase, env, cleanupTasks);
      applyAskPassEnv(env, askPass);
    }
  } else if (config.password) {
    if (!isWindowsPlatform() && await isCommandAvailable('sshpass')) {
      env.SSHPASS = config.password;
      cleanupTasks.push(async () => {
        delete env.SSHPASS;
      });

      return {
        command: 'sshpass',
        prefixArgs: ['-e'],
        sshCommand: buildSshCommand(sshArgs),
        env,
        cleanup: async () => {
          for (const task of cleanupTasks) {
            await task();
          }
        }
      };
    }

    const askPass = await createAskPassHelper(config.password, env, cleanupTasks);
    applyAskPassEnv(env, askPass);
    sshArgs.push('-o', 'PreferredAuthentications=password', '-o', 'PubkeyAuthentication=no');
  } else {
    sshArgs.push('-o', 'BatchMode=yes');
  }

  return {
    command: 'rsync',
    prefixArgs: [],
    sshCommand: buildSshCommand(sshArgs),
    env,
    cleanup: async () => {
      for (const task of cleanupTasks) {
        await task();
      }
    }
  };
}

async function runRsync(
  auth: RsyncAuthSetup,
  capabilities: RsyncCapabilities,
  excludePatterns: string[],
  source: string,
  destination: string,
  onPercent: (percent: number) => void
): Promise<void> {
  const rsyncArgs = [
    '-az',
    '--delete',
    '--partial',
    ...(capabilities.supportsProgress2 ? ['--info=progress2'] : ['--progress']),
    ...buildRsyncExcludeArgs(excludePatterns),
    '-e',
    auth.sshCommand,
    source,
    destination
  ];

  const args = auth.command === 'rsync'
    ? rsyncArgs
    : [...auth.prefixArgs, 'rsync', ...rsyncArgs];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(auth.command, args, {
      env: auth.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWindowsPlatform() && auth.command !== 'rsync'
    });

    let stderr = '';
    let lastPercent = 0;

    const handleOutput = (chunk: Buffer | string) => {
      const text = String(chunk);
      stderr += text;

      for (const line of text.split(/\r?\n/)) {
        const percent = parseRsyncProgressPercent(line);
        if (percent !== undefined && percent >= lastPercent) {
          lastPercent = percent;
          onPercent(percent);
        }
      }
    };

    child.stdout.on('data', handleOutput);
    child.stderr.on('data', handleOutput);

    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) {
        onPercent(100);
        resolve();
        return;
      }

      reject(new Error(trimRsyncError(stderr) || `rsync exited with code ${code ?? 'unknown'}`));
    });
  });
}

function trimRsyncError(stderr: string): string {
  const lines = stderr
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !/^\d/.test(line) && !line.includes('%'));

  return lines.slice(-3).join(' ').trim();
}

async function createAskPassHelper(
  secret: string,
  env: NodeJS.ProcessEnv,
  cleanupTasks: Array<() => Promise<void>>
): Promise<string> {
  if (isWindowsPlatform()) {
    const envVar = `REMOTEFORGE_ASKPASS_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    env[envVar] = secret;
    cleanupTasks.push(async () => {
      delete env[envVar];
    });

    const wrapperPath = path.join(os.tmpdir(), `remoteforge-askpass-${crypto.randomUUID()}.cmd`);
    await fs.promises.writeFile(
      wrapperPath,
      `@echo off\r\n"${process.execPath}" -e "process.stdout.write(process.env.${envVar}||'')"\r\n`
    );
    cleanupTasks.push(async () => removeFileIfExists(wrapperPath));
    return wrapperPath;
  }

  const scriptPath = path.join(os.tmpdir(), `remoteforge-askpass-${crypto.randomUUID()}.sh`);
  await fs.promises.writeFile(scriptPath, `#!/bin/sh\necho ${shellQuote(secret)}\n`, { mode: 0o700 });
  cleanupTasks.push(async () => removeFileIfExists(scriptPath));
  return scriptPath;
}

function applyAskPassEnv(env: NodeJS.ProcessEnv, askPassPath: string): void {
  env.SSH_ASKPASS = askPassPath;
  env.SSH_ASKPASS_REQUIRE = 'force';
  if (!isWindowsPlatform()) {
    env.DISPLAY = env.DISPLAY ?? ':0';
  }
}

function buildSshCommand(sshArgs: string[]): string {
  return ['ssh', ...sshArgs].map(shellQuote).join(' ');
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function reportProgress(options: RsyncSyncOptions, percent: number, message: string): void {
  options.onProgress?.({
    current: Math.max(0, Math.min(100, percent)),
    total: 100,
    file: message
  });
}

async function removeFileIfExists(filePath: string): Promise<void> {
  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
  }
}
