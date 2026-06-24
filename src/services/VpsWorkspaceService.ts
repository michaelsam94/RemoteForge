import * as vscode from 'vscode';
import { ProfileManager } from '../core/profile/ProfileManager';
import {
  resolveRemoteWorkspacePath,
  syncSingleFileToVps,
  syncWorkspaceFromVps,
  syncWorkspaceToVps
} from '../core/sync/WorkspaceSync';
import { SyncResult } from '../core/sync/sftpOperations';
import { SyncProgressHandler, createStatusBarProgressReporter } from '../core/sync/syncProgressReporting';
import { VPS_WORKSPACE_STATE_KEY, VpsWorkspaceState } from '../core/workspace/VpsWorkspaceTypes';
import { DelegateTerminalManager } from './DelegateTerminalManager';

export class VpsWorkspaceService {
  private readonly changeEmitter = new vscode.EventEmitter<VpsWorkspaceState | undefined>();
  readonly onDidChange = this.changeEmitter.event;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly workspaceState: vscode.Memento,
    private readonly profileManager: ProfileManager,
    private readonly terminalManager: DelegateTerminalManager
  ) {}

  getState(): VpsWorkspaceState | undefined {
    return this.workspaceState.get<VpsWorkspaceState>(VPS_WORKSPACE_STATE_KEY);
  }

  isEnabled(): boolean {
    return this.getState()?.enabled === true;
  }

  async enableDelegateMode(
    profileId: string,
    remoteRoot?: string,
    onProgress?: SyncProgressHandler
  ): Promise<VpsWorkspaceState> {
    const state = await this.enable(profileId, remoteRoot, onProgress);
    const connect = await this.profileManager.getConnectConfig(profileId);
    await this.terminalManager.activate(this.context, state, connect);
    await this.setDelegateContext(true);
    return state;
  }

  async enable(
    profileId: string,
    remoteRoot?: string,
    onProgress?: SyncProgressHandler
  ): Promise<VpsWorkspaceState> {
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

    await this.syncToVps(state, onProgress);
    state.lastSyncedAt = new Date().toISOString();
    await this.saveState(state);
    return state;
  }

  async disableDelegateMode(): Promise<void> {
    await this.terminalManager.deactivate(this.context);
    await this.saveState(undefined);
    await this.setDelegateContext(false);
  }

  async restoreDelegateMode(): Promise<void> {
    const state = this.getState();
    if (!state?.enabled) {
      return;
    }

    try {
      const connect = await this.profileManager.getConnectConfig(state.profileId);
      await this.terminalManager.activate(this.context, state, connect);
      await this.setDelegateContext(true);
    } catch {
      await this.saveState(undefined);
      await this.setDelegateContext(false);
    }
  }

  async syncToVps(state = this.requireState(), onProgress?: SyncProgressHandler): Promise<SyncResult> {
    onProgress?.({ current: 0, total: 100, file: 'Loading VPS credentials' });
    const config = await this.getConnectConfig(state.profileId);
    const result = await syncWorkspaceToVps(config, state.localRoot, state.remoteRoot, {
      onProgress
    });

    state.lastSyncedAt = new Date().toISOString();
    await this.saveState(state);
    return result;
  }

  async syncFromVps(state = this.requireState(), onProgress?: SyncProgressHandler): Promise<SyncResult> {
    const config = await this.getConnectConfig(state.profileId);
    const result = await syncWorkspaceFromVps(config, state.localRoot, state.remoteRoot, {
      onProgress: onProgress ?? createStatusBarProgressReporter('Downloading from VPS')
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

  async syncCreatedFile(uri: vscode.Uri): Promise<void> {
    const state = this.getState();
    if (!state?.enabled) {
      return;
    }

    const relativePath = toWorkspaceRelativePath(state.localRoot, uri.fsPath);
    if (!relativePath) {
      return;
    }

    const config = await this.getConnectConfig(state.profileId);
    await syncSingleFileToVps(config, state.localRoot, state.remoteRoot, relativePath);
  }

  async execInWorkspace(command: string): Promise<import('../core/ssh/SshExecutor').RemoteExecResult> {
    const state = this.requireState();
    return this.profileManager.execOnProfile(state.profileId, command, state.remoteRoot);
  }

  toDelegateSummary(): DelegateModeSummary {
    const state = this.getState();
    if (!state?.enabled) {
      return { enabled: false };
    }

    return {
      enabled: true,
      profileId: state.profileId,
      profileName: state.profileName,
      remoteRoot: state.remoteRoot,
      lastSyncedAt: state.lastSyncedAt
    };
  }

  private requireState(): VpsWorkspaceState {
    const state = this.getState();
    if (!state?.enabled) {
      throw new Error('Delegate mode is not enabled for this workspace');
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

  private async setDelegateContext(enabled: boolean): Promise<void> {
    await vscode.commands.executeCommand('setContext', 'remoteforge.delegateModeEnabled', enabled);
  }
}

export interface DelegateModeSummary {
  enabled: boolean;
  profileId?: string;
  profileName?: string;
  remoteRoot?: string;
  lastSyncedAt?: string;
}

export function getWorkspaceRoot(): string {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) {
    throw new Error('Open a workspace folder before enabling delegate mode');
  }

  return folder.uri.fsPath;
}

function toWorkspaceRelativePath(workspaceRoot: string, filePath: string): string | undefined {
  const relativePath = filePath.slice(workspaceRoot.length + 1).replace(/\\/g, '/');
  return relativePath.length > 0 ? relativePath : undefined;
}
