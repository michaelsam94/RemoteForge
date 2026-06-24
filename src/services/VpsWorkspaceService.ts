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
import { SshConnectConfig } from '../core/ssh/SshCredentials';
import { VPS_WORKSPACE_STATE_KEY, VpsWorkspaceState } from '../core/workspace/VpsWorkspaceTypes';
import { DelegateCursorHooks } from './DelegateCursorHooks';
import { DelegateSshMultiplexer } from './DelegateSshMultiplexer';
import { DelegateTerminalManager } from './DelegateTerminalManager';

export class VpsWorkspaceService {
  private readonly changeEmitter = new vscode.EventEmitter<VpsWorkspaceState | undefined>();
  readonly onDidChange = this.changeEmitter.event;
  private readonly sshMultiplexer = new DelegateSshMultiplexer();
  private readonly cursorHooks = new DelegateCursorHooks();

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
  ): Promise<{ state: VpsWorkspaceState; sync: SyncResult }> {
    const result = await this.enable(profileId, remoteRoot, onProgress);

    try {
      const connect = await this.profileManager.getConnectConfig(profileId);
      await this.activateDelegateRuntime(result.state, connect);
      return result;
    } catch (error) {
      await this.deactivateDelegateRuntime(result.state.localRoot);
      await this.saveState(undefined);
      await this.setDelegateContext(false);
      throw error;
    }
  }

  private async activateDelegateRuntime(state: VpsWorkspaceState, connect: SshConnectConfig): Promise<void> {
    try {
      const hookConfig = await this.sshMultiplexer.start(connect, state.localRoot, state.remoteRoot);
      await this.cursorHooks.install(state.localRoot, hookConfig);
    } catch (error) {
      void vscode.window.showWarningMessage(
        `RemoteForge could not redirect Cursor Agent shell commands to the VPS (${messageFromError(error)}). Integrated terminal routing is still enabled.`
      );
    }

    await this.terminalManager.activate(this.context, state, connect);
    await this.setDelegateContext(true);
  }

  async enable(
    profileId: string,
    remoteRoot?: string,
    onProgress?: SyncProgressHandler
  ): Promise<{ state: VpsWorkspaceState; sync: SyncResult }> {
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

    const config = await this.getConnectConfig(profile.id);
    const sync = await syncWorkspaceToVps(config, state.localRoot, state.remoteRoot, { onProgress });
    state.lastSyncedAt = new Date().toISOString();
    await this.saveState(state);
    return { state, sync };
  }

  async disableDelegateMode(): Promise<void> {
    const state = this.getState();
    const workspaceRoot = state?.localRoot ?? getWorkspaceRootOrUndefined();

    try {
      await this.deactivateDelegateRuntime(workspaceRoot);
    } finally {
      await this.saveState(undefined);
      await this.setDelegateContext(false);
    }
  }

  private async deactivateDelegateRuntime(workspaceRoot?: string): Promise<void> {
    await this.sshMultiplexer.stop();
    if (workspaceRoot) {
      await this.cursorHooks.uninstall(workspaceRoot);
    }
    await this.terminalManager.deactivate(this.context);
  }

  async restoreDelegateMode(): Promise<void> {
    const state = this.getState();
    if (!state?.enabled) {
      return;
    }

    try {
      const connect = await this.profileManager.getConnectConfig(state.profileId);
      await this.activateDelegateRuntime(state, connect);
    } catch {
      await this.deactivateDelegateRuntime(state.localRoot);
      await this.saveState(undefined);
      await this.setDelegateContext(false);
    }
  }

  openDelegateTerminal(): void {
    this.terminalManager.openTerminal();
  }

  async syncToVps(state = this.requireState(), onProgress?: SyncProgressHandler): Promise<SyncResult> {
    onProgress?.({ current: 0, total: 100, file: 'Loading VPS credentials' });
    const config = await this.getConnectConfig(state.profileId);
    const result = await syncWorkspaceToVps(config, state.localRoot, state.remoteRoot, {
      onProgress,
      forceSync: true
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

function getWorkspaceRootOrUndefined(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function toWorkspaceRelativePath(workspaceRoot: string, filePath: string): string | undefined {
  const relativePath = filePath.slice(workspaceRoot.length + 1).replace(/\\/g, '/');
  return relativePath.length > 0 ? relativePath : undefined;
}
