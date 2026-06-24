import * as vscode from 'vscode';
import { resolveRemoteWorkspacePath } from '../core/sync/WorkspaceSync';
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
    { placeHolder: 'Select the VPS profile to clone this workspace to' }
  );

  if (!selected) {
    return;
  }

  const remoteRoot = await vscode.window.showInputBox({
    value: selected.remoteRoot,
    prompt: 'Remote directory on the VPS where this repo will be cloned',
    placeHolder: selected.remoteRoot
  });

  if (!remoteRoot?.trim()) {
    return;
  }

  const confirmed = await vscode.window.showWarningMessage(
    `RemoteForge will upload the current workspace to ${remoteRoot.trim()} and run future commands there.`,
    { modal: true },
    'Enable VPS Mode'
  );

  if (confirmed !== 'Enable VPS Mode') {
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `RemoteForge: cloning workspace to ${selected.label}`,
      cancellable: false
    },
    async () => {
      try {
        const state = await workspaceService.enable(selected.profileId, remoteRoot.trim());
        await vscode.window.showInformationMessage(
          `RemoteForge VPS mode enabled. Workspace synced to ${state.remoteRoot}.`
        );
      } catch (error) {
        await vscode.window.showErrorMessage(messageFromError(error));
      }
    }
  );
}

export async function disableVpsMode(workspaceService: VpsWorkspaceService): Promise<void> {
  if (!workspaceService.isEnabled()) {
    await vscode.window.showInformationMessage('RemoteForge VPS mode is not enabled for this workspace.');
    return;
  }

  await workspaceService.disable();
  await vscode.window.showInformationMessage('RemoteForge VPS mode disabled for this workspace.');
}

export async function syncWorkspaceToVps(workspaceService: VpsWorkspaceService): Promise<void> {
  if (!workspaceService.isEnabled()) {
    await vscode.window.showWarningMessage('Enable RemoteForge VPS mode before syncing.');
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'RemoteForge: syncing workspace to VPS',
      cancellable: false
    },
    async () => {
      try {
        const result = await workspaceService.syncToVps();
        await vscode.window.showInformationMessage(`RemoteForge uploaded ${result.uploaded} files to the VPS.`);
      } catch (error) {
        await vscode.window.showErrorMessage(messageFromError(error));
      }
    }
  );
}

export async function syncWorkspaceFromVps(workspaceService: VpsWorkspaceService): Promise<void> {
  if (!workspaceService.isEnabled()) {
    await vscode.window.showWarningMessage('Enable RemoteForge VPS mode before syncing.');
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'RemoteForge: syncing workspace from VPS',
      cancellable: false
    },
    async () => {
      try {
        const result = await workspaceService.syncFromVps();
        await vscode.window.showInformationMessage(`RemoteForge downloaded ${result.downloaded} files from the VPS.`);
      } catch (error) {
        await vscode.window.showErrorMessage(messageFromError(error));
      }
    }
  );
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
