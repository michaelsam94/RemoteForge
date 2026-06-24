import * as vscode from 'vscode';
import { ProfileManager } from '../core/profile/ProfileManager';
import {
  resolveRemoteWorkspacePath,
  syncSingleFileToVps,
  syncWorkspaceFromVps,
  syncWorkspaceToVps
} from '../core/sync/WorkspaceSync';
import { SyncProgress, SyncResult } from '../core/sync/sftpOperations';
import { VPS_WORKSPACE_STATE_KEY, VpsWorkspaceState } from '../core/workspace/VpsWorkspaceTypes';

export class VpsWorkspaceService {
  private readonly changeEmitter = new vscode.EventEmitter<VpsWorkspaceState | undefined>();
  readonly onDidChange = this.changeEmitter.event;

  constructor(
    private readonly workspaceState: vscode.Memento,
    private readonly profileManager: ProfileManager
  ) {}

  getState(): VpsWorkspaceState | undefined {
    return this.workspaceState.get<VpsWorkspaceState>(VPS_WORKSPACE_STATE_KEY);
  }

  isEnabled(): boolean {
    return this.getState()?.enabled === true;
  }

  async enable(profileId: string, remoteRoot?: string): Promise<VpsWorkspaceState> {
    const workspaceRoot = getWorkspaceRoot();
    const profiles = await this.profileManager.listProfiles();
    const profile = profiles.find(entry => entry.id === profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    const resolvedRemoteRoot = remoteRoot?.trim() || resolveRemoteWorkspacePath(profile, workspaceRoot);
    const state: VpsWorkspaceState = {
      enabled: true,
      profileId: profile.id,
      profileName: profile.name,
      localRoot: workspaceRoot,
      remoteRoot: resolvedRemoteRoot
    };

    await this.syncToVps(state);
    state.lastSyncedAt = new Date().toISOString();
    await this.saveState(state);
    return state;
  }

  async disable(): Promise<void> {
    await this.saveState(undefined);
  }

  async syncToVps(state = this.requireState()): Promise<SyncResult> {
    const config = await this.getConnectConfig(state.profileId);
    const result = await syncWorkspaceToVps(config, state.localRoot, state.remoteRoot, {
      onProgress: progress => this.reportProgress('Uploading to VPS', progress)
    });

    state.lastSyncedAt = new Date().toISOString();
    await this.saveState(state);
    return result;
  }

  async syncFromVps(state = this.requireState()): Promise<SyncResult> {
    const config = await this.getConnectConfig(state.profileId);
    const result = await syncWorkspaceFromVps(config, state.localRoot, state.remoteRoot, {
      onProgress: progress => this.reportProgress('Downloading from VPS', progress)
    });

    state.lastSyncedAt = new Date().toISOString();
    await this.saveState(state);
    return result;
  }

  async syncSavedFile(document: vscode.TextDocument): Promise<void> {
    const state = this.getState();
    if (!state?.enabled) {
      return;
    }

    const relativePath = toWorkspaceRelativePath(state.localRoot, document.uri.fsPath);
    if (!relativePath) {
      return;
    }

    const config = await this.getConnectConfig(state.profileId);
    await syncSingleFileToVps(config, state.localRoot, state.remoteRoot, relativePath);
    state.lastSyncedAt = new Date().toISOString();
    await this.saveState(state);
  }

  async execInWorkspace(command: string): Promise<import('../core/ssh/SshExecutor').RemoteExecResult> {
    const state = this.requireState();
    return this.profileManager.execOnProfile(state.profileId, command, state.remoteRoot);
  }

  private requireState(): VpsWorkspaceState {
    const state = this.getState();
    if (!state?.enabled) {
      throw new Error('VPS workspace mode is not enabled for this folder');
    }

    return state;
  }

  private async getConnectConfig(profileId: string) {
    return this.profileManager.getConnectConfig(profileId);
  }

  private async saveState(state: VpsWorkspaceState | undefined): Promise<void> {
    if (state) {
      await this.workspaceState.update(VPS_WORKSPACE_STATE_KEY, state);
    } else {
      await this.workspaceState.update(VPS_WORKSPACE_STATE_KEY, undefined);
    }

    this.changeEmitter.fire(state);
  }

  private reportProgress(title: string, progress: SyncProgress): void {
    void vscode.window.setStatusBarMessage(`${title}: ${progress.file} (${progress.current}/${progress.total})`, 2000);
  }
}

export function getWorkspaceRoot(): string {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    throw new Error('Open a workspace folder before enabling VPS mode');
  }

  return folder.uri.fsPath;
}

function toWorkspaceRelativePath(workspaceRoot: string, filePath: string): string | undefined {
  const relativePath = filePath.slice(workspaceRoot.length + 1).replace(/\\/g, '/');
  return relativePath.length > 0 ? relativePath : undefined;
}
