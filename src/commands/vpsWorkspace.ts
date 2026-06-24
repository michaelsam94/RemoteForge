import * as vscode from 'vscode';
import { resolveRemoteWorkspacePath } from '../core/sync/WorkspaceSync';
import { createNotificationProgressReporter } from '../core/sync/syncProgressReporting';
import { ProfileManager } from '../core/profile/ProfileManager';
import { getWorkspaceRoot, VpsWorkspaceService } from '../services/VpsWorkspaceService';

export async function enableVpsMode(
  profileManager: ProfileManager,
  workspaceService: VpsWorkspaceService
): Promise<void> {
  const profiles = await profileManager.listProfiles();
  if (profiles.length === 0) {
    await vscode.window.showWarningMessage('RemoteForge has no saved VPS profiles. Open configuration to add one.');
    return;
  }

  const workspaceRoot = getWorkspaceRoot();
  const selected = await vscode.window.showQuickPick(
    profiles.map(profile => ({
      label: profile.name,
      description: `${profile.username}@${profile.host}:${profile.port}`,
      detail: resolveRemoteWorkspacePath(profile, workspaceRoot),
      profileId: profile.id,
      remoteRoot: resolveRemoteWorkspacePath(profile, workspaceRoot)
    })),
    { placeHolder: 'Select the VPS profile to delegate this workspace to'
    }
  );

  if (!selected) {
    return;
  }

  await enableDelegateModeWithPrompt(workspaceService, selected.profileId, selected.remoteRoot);
}

export async function enableDelegateModeWithPrompt(
  workspaceService: VpsWorkspaceService,
  profileId: string,
  remoteRoot: string
): Promise<void> {
  const confirmed = await vscode.window.showWarningMessage(
    `RemoteForge will migrate this workspace to ${remoteRoot} and route terminals and commands to the VPS.`,
    { modal: true },
    'Enable Delegate Mode'
  );

  if (confirmed !== 'Enable Delegate Mode') {
    return;
  }

  await runDelegateActivation(workspaceService, profileId, remoteRoot);
}

export async function runDelegateActivation(
  workspaceService: VpsWorkspaceService,
  profileId: string,
  remoteRoot: string
): Promise<void> {
  await runWithSyncProgress(
    'RemoteForge: migrating workspace to VPS',
    async report => {
      const state = await workspaceService.enableDelegateMode(profileId, remoteRoot.trim(), report);
      await vscode.window.showInformationMessage(
        `Delegate mode enabled. Workspace synced to ${state.remoteRoot}. Use the RemoteForge terminal for commands.`
      );
    }
  );
}

export async function disableVpsMode(workspaceService: VpsWorkspaceService): Promise<void> {
  if (!workspaceService.isEnabled()) {
    await vscode.window.showInformationMessage('RemoteForge delegate mode is not enabled for this workspace.');
    return;
  }

  await workspaceService.disableDelegateMode();
  await vscode.window.showInformationMessage('RemoteForge delegate mode disabled for this workspace.');
}

export async function syncWorkspaceToVps(workspaceService: VpsWorkspaceService): Promise<void> {
  if (!workspaceService.isEnabled()) {
    await vscode.window.showWarningMessage('Enable RemoteForge delegate mode before syncing.');
    return;
  }

  await runWithSyncProgress(
    'RemoteForge: syncing workspace to VPS',
    async report => {
      const result = await workspaceService.syncToVps(undefined, report);
      await vscode.window.showInformationMessage(`RemoteForge uploaded ${result.uploaded} files to the VPS.`);
    }
  );
}

export async function syncWorkspaceFromVps(workspaceService: VpsWorkspaceService): Promise<void> {
  if (!workspaceService.isEnabled()) {
    await vscode.window.showWarningMessage('Enable RemoteForge delegate mode before syncing.');
    return;
  }

  await runWithSyncProgress(
    'RemoteForge: syncing workspace from VPS',
    async report => {
      const result = await workspaceService.syncFromVps(undefined, report);
      await vscode.window.showInformationMessage(`RemoteForge downloaded ${result.downloaded} files from the VPS.`);
    }
  );
}

async function runWithSyncProgress(
  title: string,
  operation: (report: ReturnType<typeof createNotificationProgressReporter>) => Promise<void>
): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title,
      cancellable: false
    },
    async progress => {
      try {
        progress.report({ message: '0% — Preparing workspace sync' });
        await operation(createNotificationProgressReporter(progress));
      } catch (error) {
        await vscode.window.showErrorMessage(messageFromError(error));
      }
    }
  );
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
