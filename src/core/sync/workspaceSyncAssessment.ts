import { SFTPWrapper } from 'ssh2';
import { SshConnectConfig } from '../ssh/SshCredentials';
import { withSshClient } from '../ssh/SshExecutor';
import { collectWorkspaceFilesAsync, WorkspaceFileEntry } from './collectWorkspaceFiles';
import { listRemoteFileManifest } from './sftpOperations';

export interface FileManifestEntry {
  relativePath: string;
  size: number;
}

export interface WorkspaceSyncAssessment {
  needsSync: boolean;
  localFileCount: number;
  remoteFileCount: number;
  missingOnRemote: number;
  sizeMismatch: number;
  message: string;
}

export async function assessWorkspaceSyncNeeded(
  config: SshConnectConfig,
  workspaceRoot: string,
  remoteRoot: string,
  excludePatterns: string[],
  onProgress?: (message: string) => void
): Promise<WorkspaceSyncAssessment> {
  onProgress?.('Scanning local workspace');
  const localFiles = await collectWorkspaceFilesAsync(workspaceRoot, { excludePatterns });
  const localManifest = toManifest(localFiles);

  onProgress?.('Checking remote workspace on VPS');
  let remoteManifest: FileManifestEntry[] = [];

  try {
    await withSshClient(config, { connectTimeoutMs: 30000 }, client => openSftp(client, async sftp => {
      remoteManifest = toManifestFromRemote(await listRemoteFileManifest(sftp, remoteRoot, excludePatterns));
    }));
  } catch (error) {
    if (isMissingRemoteRoot(error)) {
      return buildNeedsSyncAssessment(localManifest, [], 'Remote workspace not found on VPS');
    }

    throw error;
  }

  return compareWorkspaceManifests(localManifest, remoteManifest);
}

export function compareWorkspaceManifests(
  localFiles: FileManifestEntry[],
  remoteFiles: FileManifestEntry[]
): WorkspaceSyncAssessment {
  if (localFiles.length === 0) {
    return {
      needsSync: false,
      localFileCount: 0,
      remoteFileCount: remoteFiles.length,
      missingOnRemote: 0,
      sizeMismatch: 0,
      message: 'No files to sync'
    };
  }

  const remoteByPath = new Map(remoteFiles.map(file => [file.relativePath, file.size]));
  let missingOnRemote = 0;
  let sizeMismatch = 0;

  for (const localFile of localFiles) {
    const remoteSize = remoteByPath.get(localFile.relativePath);
    if (remoteSize === undefined) {
      missingOnRemote += 1;
      continue;
    }

    if (remoteSize !== localFile.size) {
      sizeMismatch += 1;
    }
  }

  if (missingOnRemote === 0 && sizeMismatch === 0) {
    return {
      needsSync: false,
      localFileCount: localFiles.length,
      remoteFileCount: remoteFiles.length,
      missingOnRemote: 0,
      sizeMismatch: 0,
      message: `Workspace already on VPS (${localFiles.length} files up to date)`
    };
  }

  return {
    needsSync: true,
    localFileCount: localFiles.length,
    remoteFileCount: remoteFiles.length,
    missingOnRemote,
    sizeMismatch,
    message: buildNeedsSyncMessage(missingOnRemote, sizeMismatch)
  };
}

function buildNeedsSyncAssessment(
  localFiles: FileManifestEntry[],
  remoteFiles: FileManifestEntry[],
  reason: string
): WorkspaceSyncAssessment {
  return {
    needsSync: true,
    localFileCount: localFiles.length,
    remoteFileCount: remoteFiles.length,
    missingOnRemote: localFiles.length,
    sizeMismatch: 0,
    message: reason
  };
}

function buildNeedsSyncMessage(missingOnRemote: number, sizeMismatch: number): string {
  const parts: string[] = [];
  if (missingOnRemote > 0) {
    parts.push(`${missingOnRemote} missing on VPS`);
  }
  if (sizeMismatch > 0) {
    parts.push(`${sizeMismatch} changed locally`);
  }

  return parts.join(', ');
}

function toManifest(files: WorkspaceFileEntry[]): FileManifestEntry[] {
  return files.map(file => ({
    relativePath: file.relativePath,
    size: file.size
  }));
}

function toManifestFromRemote(
  files: Array<{ relativePath: string; size: number }>
): FileManifestEntry[] {
  return files.map(file => ({
    relativePath: file.relativePath,
    size: file.size
  }));
}

function isMissingRemoteRoot(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return false;
  }

  return error.code === 'ENOENT' || error.code === 2;
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
