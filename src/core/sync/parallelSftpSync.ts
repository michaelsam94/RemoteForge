import { SFTPWrapper } from 'ssh2';
import { SshConnectConfig } from '../ssh/SshCredentials';
import { withSshClient } from '../ssh/SshExecutor';
import { WorkspaceFileEntry } from './collectWorkspaceFiles';
import { ensureRemoteDirectory, SyncProgress, SyncResult, uploadFile } from './sftpOperations';

const DEFAULT_UPLOAD_CONCURRENCY = 32;

export interface ParallelSftpSyncOptions {
  onProgress?: (progress: SyncProgress) => void;
  concurrency?: number;
}

export async function syncWorkspaceViaParallelSftp(
  config: SshConnectConfig,
  remoteRoot: string,
  files: WorkspaceFileEntry[],
  options: ParallelSftpSyncOptions = {}
): Promise<SyncResult> {
  const concurrency = options.concurrency ?? DEFAULT_UPLOAD_CONCURRENCY;
  let uploaded = 0;

  await withSshClient(config, {}, client => openSftp(client, async sftp => {
    await ensureRemoteDirectoryTree(sftp, remoteRoot, files);

    await mapPool(files, concurrency, async (file, index) => {
      const remotePath = `${remoteRoot}/${file.relativePath}`.replace(/\/+/g, '/');
      await uploadFile(sftp, file.absolutePath, remotePath, { skipMkdir: true });
      uploaded += 1;
      options.onProgress?.({
        current: index + 1,
        total: files.length,
        file: file.relativePath
      });
    });
  }));

  return { uploaded, downloaded: 0, skipped: 0 };
}

async function ensureRemoteDirectoryTree(
  sftp: SFTPWrapper,
  remoteRoot: string,
  files: WorkspaceFileEntry[]
): Promise<void> {
  const directories = new Set<string>([remoteRoot]);

  for (const file of files) {
    const parts = file.relativePath.split('/');
    for (let index = 0; index < parts.length - 1; index += 1) {
      directories.add(`${remoteRoot}/${parts.slice(0, index + 1).join('/')}`.replace(/\/+/g, '/'));
    }
  }

  const sorted = [...directories].sort((left, right) => left.length - right.length);
  for (const directory of sorted) {
    await ensureRemoteDirectory(sftp, directory);
  }
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>
): Promise<void> {
  let nextIndex = 0;

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      await worker(items[currentIndex], currentIndex);
    }
  }));
}

async function openSftp(
  client: { sftp: (callback: (error: Error | undefined, sftp: SFTPWrapper) => void) => void },
  run: (sftp: SFTPWrapper) => Promise<void>
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    client.sftp((error, sftp) => {
      if (error) {
        reject(error);
        return;
      }

      void run(sftp).then(resolve).catch(reject);
    });
  });
}
