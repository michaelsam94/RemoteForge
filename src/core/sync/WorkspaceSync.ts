import * as fs from 'fs';
import * as path from 'path';
import { SFTPWrapper } from 'ssh2';
import { SshConnectConfig } from '../ssh/SshCredentials';
import { withSshClient } from '../ssh/SshExecutor';
import { collectWorkspaceFiles, loadGitignorePatterns } from './collectWorkspaceFiles';
import { downloadFile, listRemoteFiles, remoteWorkspacePath, SyncProgress, SyncResult, uploadFile } from './sftpOperations';
import { DEFAULT_SYNC_EXCLUDES, mergeExcludePatterns, shouldExclude } from './syncExcludes';
import { VpsProfile } from '../profile/ProfileTypes';

export interface WorkspaceSyncOptions {
  onProgress?: (progress: SyncProgress) => void;
}

export function buildExcludePatterns(workspaceRoot: string): string[] {
  return mergeExcludePatterns(DEFAULT_SYNC_EXCLUDES, loadGitignorePatterns(workspaceRoot));
}

export function resolveRemoteWorkspacePath(profile: VpsProfile, workspaceRoot: string): string {
  return remoteWorkspacePath(profile, path.basename(workspaceRoot));
}

export async function syncWorkspaceToVps(
  config: SshConnectConfig,
  workspaceRoot: string,
  remoteRoot: string,
  options: WorkspaceSyncOptions = {}
): Promise<SyncResult> {
  const excludePatterns = buildExcludePatterns(workspaceRoot);
  const files = collectWorkspaceFiles(workspaceRoot, { excludePatterns });
  let uploaded = 0;

  await withSshClient(config, {}, client => openSftp(client, async sftp => {
    for (const [index, file] of files.entries()) {
      options.onProgress?.({ current: index + 1, total: files.length, file: file.relativePath });
      const remotePath = `${remoteRoot}/${file.relativePath}`.replace(/\/+/g, '/');
      await uploadFile(sftp, file.absolutePath, remotePath);
      uploaded += 1;
    }
  }));

  return { uploaded, downloaded: 0, skipped: 0 };
}

export async function syncWorkspaceFromVps(
  config: SshConnectConfig,
  workspaceRoot: string,
  remoteRoot: string,
  options: WorkspaceSyncOptions = {}
): Promise<SyncResult> {
  const excludePatterns = buildExcludePatterns(workspaceRoot);
  let downloaded = 0;

  await withSshClient(config, {}, client => openSftp(client, async sftp => {
    const remoteFiles = await listRemoteFiles(sftp, remoteRoot, excludePatterns);

    for (const [index, file] of remoteFiles.entries()) {
      options.onProgress?.({ current: index + 1, total: remoteFiles.length, file: file.relativePath });
      const localPath = path.join(workspaceRoot, file.relativePath);
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      await downloadFile(sftp, file.remotePath, localPath);
      downloaded += 1;
    }
  }));

  return { uploaded: 0, downloaded, skipped: 0 };
}

export async function syncSingleFileToVps(
  config: SshConnectConfig,
  workspaceRoot: string,
  remoteRoot: string,
  relativePath: string
): Promise<void> {
  const excludePatterns = buildExcludePatterns(workspaceRoot);
  if (shouldExclude(relativePath, excludePatterns)) {
    return;
  }

  const localPath = path.join(workspaceRoot, relativePath);
  if (!fs.existsSync(localPath) || !fs.statSync(localPath).isFile()) {
    return;
  }

  await withSshClient(config, {}, client => openSftp(client, async sftp => {
    const remotePath = `${remoteRoot}/${relativePath}`.replace(/\\/g, '/');
    await uploadFile(sftp, localPath, remotePath);
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
