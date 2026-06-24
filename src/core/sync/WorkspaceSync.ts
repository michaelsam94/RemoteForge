import * as fs from 'fs';
import * as path from 'path';
import { SFTPWrapper } from 'ssh2';
import { SshConnectConfig } from '../ssh/SshCredentials';
import { withSshClient } from '../ssh/SshExecutor';
import { collectWorkspaceFilesAsync, loadGitignorePatterns } from './collectWorkspaceFiles';
import { syncWorkspaceViaParallelSftp } from './parallelSftpSync';
import { canRsyncWithCredentialsAsync, getRsyncCapabilities, syncWorkspaceViaRsync } from './rsyncSync';
import { downloadFile, listRemoteFiles, remoteWorkspacePath, SyncProgress, SyncResult, uploadFile } from './sftpOperations';
import { getTarCapabilities, syncWorkspaceViaTar } from './tarStreamSync';
import { DEFAULT_SYNC_EXCLUDES, mergeExcludePatterns, shouldExclude } from './syncExcludes';
import { assessWorkspaceSyncNeeded } from './workspaceSyncAssessment';
import { VpsProfile } from '../profile/ProfileTypes';

export interface WorkspaceSyncOptions {
  onProgress?: (progress: SyncProgress) => void;
  forceSync?: boolean;
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
  reportPhaseProgress(options, 0, 'Preparing workspace sync');

  const excludePatterns = buildExcludePatterns(workspaceRoot);

  if (!options.forceSync) {
    reportPhaseProgress(options, 1, 'Checking if workspace is already on VPS');
    const assessment = await assessWorkspaceSyncNeeded(
      config,
      workspaceRoot,
      remoteRoot,
      excludePatterns,
      message => reportPhaseProgress(options, 2, message)
    );

    if (!assessment.needsSync) {
      reportPhaseProgress(options, 100, assessment.message);
      return {
        uploaded: 0,
        downloaded: 0,
        skipped: assessment.localFileCount
      };
    }

    reportPhaseProgress(options, 3, `Sync needed (${assessment.message})`);
  }

  const rsyncCapabilities = await getRsyncCapabilities();
  const rsyncAuthReady = await canRsyncWithCredentialsAsync(config);

  if (rsyncCapabilities.available && rsyncAuthReady) {
    try {
      return await syncWorkspaceViaRsync(
        config,
        workspaceRoot,
        remoteRoot,
        excludePatterns,
        options
      );
    } catch (error) {
      reportPhaseProgress(
        options,
        0,
        `Rsync failed, falling back to archive upload (${messageFromError(error)})`
      );
    }
  } else if (rsyncCapabilities.skipReason) {
    reportPhaseProgress(options, 0, rsyncCapabilities.skipReason);
  } else if (rsyncCapabilities.available && !rsyncAuthReady) {
    reportPhaseProgress(
      options,
      0,
      'Password auth without sshpass — using archive upload instead.'
    );
  }

  reportPhaseProgress(options, 1, 'Scanning workspace files');
  const files = await collectWorkspaceFilesAsync(workspaceRoot, {
    excludePatterns,
    onProgress: progress => {
      reportPhaseProgress(
        options,
        1,
        `Scanning workspace files (${progress.scannedFiles} found, ${progress.currentPath})`
      );
    }
  });

  if (files.length === 0) {
    reportPhaseProgress(options, 100, 'No files to sync');
    return { uploaded: 0, downloaded: 0, skipped: 0 };
  }

  reportPhaseProgress(options, 2, `Found ${files.length} files to sync`);

  const tarCapabilities = await getTarCapabilities();
  if (!tarCapabilities.available) {
    if (tarCapabilities.skipReason) {
      reportPhaseProgress(options, 2, tarCapabilities.skipReason);
    }

    return syncWorkspaceViaParallelSftp(config, remoteRoot, files, options);
  }

  try {
    return await syncWorkspaceViaTar(
      config,
      workspaceRoot,
      remoteRoot,
      excludePatterns,
      files,
      options
    );
  } catch (error) {
    reportPhaseProgress(
      options,
      0,
      `Archive upload failed, falling back to parallel upload (${messageFromError(error)})`
    );
    return syncWorkspaceViaParallelSftp(config, remoteRoot, files, options);
  }
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

function reportPhaseProgress(options: WorkspaceSyncOptions, percent: number, message: string): void {
  options.onProgress?.({
    current: Math.max(0, Math.min(100, percent)),
    total: 100,
    file: message
  });
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
