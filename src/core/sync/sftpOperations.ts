import { SFTPWrapper } from 'ssh2';
import { VpsProfile } from '../profile/ProfileTypes';
import { shouldExclude } from './syncExcludes';

export interface SyncProgress {
  current: number;
  total: number;
  file: string;
}

export function syncProgressPercent(progress: SyncProgress): number {
  if (progress.total <= 0) {
    return progress.current > 0 ? 100 : 0;
  }

  return Math.min(100, Math.round((progress.current / progress.total) * 100));
}

export function syncProgressIncrement(progress: SyncProgress): number {
  if (progress.total <= 0) {
    return 100;
  }

  return 100 / progress.total;
}

export function formatSyncProgressMessage(progress: SyncProgress): string {
  const percent = syncProgressPercent(progress);
  if (progress.total === 100) {
    return `${percent}% — ${progress.file}`;
  }

  if (progress.total <= 0) {
    return `${percent}% — ${progress.file}`;
  }

  return `${percent}% — ${progress.file} (${progress.current}/${progress.total})`;
}

export interface SyncResult {
  uploaded: number;
  downloaded: number;
  skipped: number;
}

export function remoteWorkspacePath(profile: VpsProfile, workspaceFolderName: string): string {
  const base = profile.defaultWorkdir?.replace(/\/+$/, '')
    || (profile.username === 'root' ? '/root' : `/home/${profile.username}`);
  return `${base}/${workspaceFolderName}`;
}

export async function ensureRemoteDirectory(sftp: SFTPWrapper, remoteDirectory: string): Promise<void> {
  const segments = remoteDirectory.split('/').filter(Boolean);
  let current = remoteDirectory.startsWith('/') ? '' : '';

  for (const segment of segments) {
    current = current ? `${current}/${segment}` : `/${segment}`;
    await mkdirIfMissing(sftp, current);
  }
}

async function mkdirIfMissing(sftp: SFTPWrapper, remoteDirectory: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    sftp.mkdir(remoteDirectory, error => {
      if (!error || hasErrorCode(error, 'EEXIST')) {
        resolve();
        return;
      }

      reject(error);
    });
  });
}

export async function uploadFile(
  sftp: SFTPWrapper,
  localPath: string,
  remotePath: string,
  options: { skipMkdir?: boolean } = {}
): Promise<void> {
  const remoteDirectory = remotePath.slice(0, remotePath.lastIndexOf('/'));
  if (remoteDirectory && !options.skipMkdir) {
    await ensureRemoteDirectory(sftp, remoteDirectory);
  }

  await new Promise<void>((resolve, reject) => {
    sftp.fastPut(localPath, remotePath, error => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export async function downloadFile(
  sftp: SFTPWrapper,
  remotePath: string,
  localPath: string
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    sftp.fastGet(remotePath, localPath, error => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

export interface RemoteFileEntry {
  relativePath: string;
  remotePath: string;
  size: number;
}

export async function listRemoteFileManifest(
  sftp: SFTPWrapper,
  remoteRoot: string,
  excludePatterns: string[]
): Promise<RemoteFileEntry[]> {
  const files: RemoteFileEntry[] = [];
  await walkRemoteDirectory(sftp, remoteRoot, remoteRoot, excludePatterns, files);
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export async function listRemoteFiles(
  sftp: SFTPWrapper,
  remoteRoot: string,
  excludePatterns: string[]
): Promise<Array<{ relativePath: string; remotePath: string }>> {
  const files = await listRemoteFileManifest(sftp, remoteRoot, excludePatterns);
  return files.map(file => ({
    relativePath: file.relativePath,
    remotePath: file.remotePath
  }));
}

async function walkRemoteDirectory(
  sftp: SFTPWrapper,
  remoteRoot: string,
  currentDirectory: string,
  excludePatterns: string[],
  files: RemoteFileEntry[]
): Promise<void> {
  const entries = await readdirEntries(sftp, currentDirectory);

  for (const entry of entries) {
    if (entry.filename === '.' || entry.filename === '..') {
      continue;
    }

    const remotePath = `${currentDirectory}/${entry.filename}`.replace(/\/+/g, '/');
    const relativePath = remotePath.slice(remoteRoot.length + 1);

    if (relativePath && shouldExclude(relativePath, excludePatterns)) {
      continue;
    }

    if (entry.attrs.isDirectory()) {
      await walkRemoteDirectory(sftp, remoteRoot, remotePath, excludePatterns, files);
      continue;
    }

    if (entry.attrs.isFile()) {
      files.push({
        relativePath,
        remotePath,
        size: entry.attrs.size ?? 0
      });
    }
  }
}

interface SftpDirEntry {
  filename: string;
  attrs: {
    size?: number;
    isDirectory(): boolean;
    isFile(): boolean;
  };
}

async function readdirEntries(sftp: SFTPWrapper, remoteDirectory: string): Promise<SftpDirEntry[]> {
  return new Promise((resolve, reject) => {
    sftp.readdir(remoteDirectory, (error, list) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(list as SftpDirEntry[]);
    });
  });
}

function hasErrorCode(error: unknown, code: string): boolean {
  return error !== null
    && typeof error === 'object'
    && 'code' in error
    && error.code === code;
}
