import * as crypto from 'crypto';
import { execFile, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { SFTPWrapper } from 'ssh2';
import { Client } from 'ssh2';
import { SshConnectConfig } from '../ssh/SshCredentials';
import { RemoteExecResult, withSshClient } from '../ssh/SshExecutor';
import { WorkspaceFileEntry } from './collectWorkspaceFiles';
import { buildTarExcludeArgs } from './syncExcludes';
import { SyncProgress, SyncResult } from './sftpOperations';
import { isCommandAvailable, isWindowsPlatform } from './syncPlatform';

const execFileAsync = promisify(execFile);

export interface TarCapabilities {
  available: boolean;
  skipReason?: string;
}

export async function getTarCapabilities(): Promise<TarCapabilities> {
  if (!(await isCommandAvailable('tar'))) {
    return {
      available: false,
      skipReason: isWindowsPlatform()
        ? 'tar is not available on Windows — using parallel SFTP upload instead.'
        : 'tar is not available — using parallel SFTP upload instead.'
    };
  }

  try {
    await execFileAsync('tar', ['--version']);
    return { available: true };
  } catch {
    return {
      available: false,
      skipReason: isWindowsPlatform()
        ? 'tar could not be started on Windows — using parallel SFTP upload instead.'
        : 'tar could not be started — using parallel SFTP upload instead.'
    };
  }
}

const FAST_PUT_CHUNK_SIZE = 512 * 1024;
const FAST_PUT_CONCURRENCY = 64;

export interface TarStreamSyncOptions {
  onProgress?: (progress: SyncProgress) => void;
}

export async function syncWorkspaceViaTar(
  config: SshConnectConfig,
  workspaceRoot: string,
  remoteRoot: string,
  excludePatterns: string[],
  files: WorkspaceFileEntry[],
  options: TarStreamSyncOptions = {}
): Promise<SyncResult> {
  const archivePath = path.join(os.tmpdir(), `remoteforge-${crypto.randomUUID()}.tar.gz`);
  const remoteArchivePath = `/tmp/remoteforge-${crypto.randomUUID()}.tar.gz`;

  try {
    reportProgress(options, 0, `Packing ${files.length} files locally`);
    await createLocalArchive(workspaceRoot, excludePatterns, archivePath, files, fraction => {
      reportProgress(options, Math.round(fraction * 20), 'Creating compressed archive');
    });

    const archiveSize = fs.statSync(archivePath).size;
    reportProgress(options, 20, `Uploading archive (${formatBytes(archiveSize)})`);

    await withSshClient(config, { connectTimeoutMs: 120000 }, async client => {
      await uploadArchiveFast(client, archivePath, remoteArchivePath, archiveSize, fraction => {
        const percent = 20 + Math.round(fraction * 70);
        reportProgress(
          options,
          percent,
          `Uploading archive (${formatBytes(Math.round(archiveSize * fraction))} / ${formatBytes(archiveSize)})`
        );
      });

      reportProgress(options, 92, 'Extracting archive on VPS');
      const extract = await execOnClient(
        client,
        `mkdir -p ${shellQuote(remoteRoot)} && tar -xzf ${shellQuote(remoteArchivePath)} -C ${shellQuote(remoteRoot)} && rm -f ${shellQuote(remoteArchivePath)}`
      );

      if (extract.exitCode !== 0) {
        throw new Error(extract.stderr.trim() || `Remote extract failed with exit code ${extract.exitCode ?? 'unknown'}`);
      }
    });

    reportProgress(options, 100, `Migration complete (${files.length} files)`);
    return { uploaded: files.length, downloaded: 0, skipped: 0 };
  } finally {
    await removeFileIfExists(archivePath);
  }
}

async function createLocalArchive(
  workspaceRoot: string,
  excludePatterns: string[],
  archivePath: string,
  files: WorkspaceFileEntry[],
  onFraction: (fraction: number) => void
): Promise<void> {
  const estimatedBytes = Math.max(files.reduce((total, file) => total + file.size, 0) / 3, 1024);

  await new Promise<void>((resolve, reject) => {
    const tar = spawn('tar', [
      '-czf',
      archivePath,
      ...buildTarExcludeArgs(excludePatterns),
      '-C',
      workspaceRoot,
      '.'
    ], {
      env: { ...process.env, GZIP: '-1' },
      stdio: ['ignore', 'ignore', 'pipe']
    });

    let stderr = '';
    tar.stderr.on('data', (chunk: Buffer | string) => {
      stderr += String(chunk);
    });

    const timer = setInterval(() => {
      if (!fs.existsSync(archivePath)) {
        return;
      }

      const size = fs.statSync(archivePath).size;
      onFraction(Math.min(0.99, size / estimatedBytes));
    }, 250);

    tar.on('error', error => {
      clearInterval(timer);
      reject(error);
    });

    tar.on('close', exitCode => {
      clearInterval(timer);
      if (exitCode === 0) {
        onFraction(1);
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `Local tar failed with exit code ${exitCode ?? 'unknown'}`));
    });
  });
}

async function uploadArchiveFast(
  client: { sftp: (callback: (error: Error | undefined, sftp: SFTPWrapper) => void) => void },
  localPath: string,
  remotePath: string,
  totalBytes: number,
  onFraction: (fraction: number) => void
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    client.sftp((error, sftp) => {
      if (error) {
        reject(error);
        return;
      }

      sftp.fastPut(localPath, remotePath, {
        chunkSize: FAST_PUT_CHUNK_SIZE,
        concurrency: FAST_PUT_CONCURRENCY,
        step: transferred => {
          onFraction(Math.min(1, transferred / totalBytes));
        }
      }, putError => {
        if (putError) {
          reject(putError);
          return;
        }

        onFraction(1);
        resolve();
      });
    });
  });
}

function reportProgress(options: TarStreamSyncOptions, percent: number, message: string): void {
  options.onProgress?.({
    current: Math.max(0, Math.min(100, percent)),
    total: 100,
    file: message
  });
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function execOnClient(client: Client, command: string): Promise<RemoteExecResult> {
  return new Promise((resolve, reject) => {
    client.exec(command, (error, stream) => {
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
  });
}

async function removeFileIfExists(filePath: string): Promise<void> {
  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
  }
}
