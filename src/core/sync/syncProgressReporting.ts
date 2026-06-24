import * as vscode from 'vscode';
import { SyncProgress, formatSyncProgressMessage } from './sftpOperations';

export type SyncProgressHandler = (progress: SyncProgress) => void;

export function createNotificationProgressReporter(
  progress: vscode.Progress<{ message?: string; increment?: number }>
): SyncProgressHandler {
  let lastPercent = -1;

  return (syncProgress: SyncProgress) => {
    const percent = syncProgress.total === 100
      ? syncProgress.current
      : Math.round((syncProgress.current / Math.max(syncProgress.total, 1)) * 100);

    const increment = percent > lastPercent ? percent - lastPercent : 0;
    lastPercent = Math.max(lastPercent, percent);

    progress.report({
      message: formatSyncProgressMessage(syncProgress),
      ...(increment > 0 ? { increment } : { increment: 0 })
    });
  };
}

export function createStatusBarProgressReporter(title: string): SyncProgressHandler {
  return (syncProgress: SyncProgress) => {
    void vscode.window.setStatusBarMessage(`${title}: ${formatSyncProgressMessage(syncProgress)}`, 3000);
  };
}
