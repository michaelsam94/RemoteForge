import * as vscode from 'vscode';
import { SshConnectConfig } from '../core/ssh/SshCredentials';
import { VpsWorkspaceState } from '../core/workspace/VpsWorkspaceTypes';
import { RemoteSshPseudoterminal } from '../terminal/RemoteSshPseudoterminal';

import { defaultProfileSettingKey, delegateTerminalProfileId } from '../core/workspace/terminalProfileKeys';

export class DelegateTerminalManager {
  private delegateTerminals: vscode.Terminal[] = [];

  createTerminalProfile(
    state: VpsWorkspaceState,
    connect: SshConnectConfig
  ): vscode.TerminalProfile {
    return new vscode.TerminalProfile({
      name: `RemoteForge: ${state.profileName}`,
      pty: new RemoteSshPseudoterminal(connect, state.remoteRoot)
    });
  }

  async activate(context: vscode.ExtensionContext, state: VpsWorkspaceState, connect: SshConnectConfig): Promise<void> {
    await this.setDefaultTerminalProfile(context, delegateTerminalProfileId);
    this.openTerminal(state, connect);
  }

  async deactivate(context: vscode.ExtensionContext): Promise<void> {
    await this.restoreDefaultTerminalProfile(context);
    for (const terminal of this.delegateTerminals) {
      terminal.dispose();
    }
    this.delegateTerminals = [];
  }

  openTerminal(state: VpsWorkspaceState, connect: SshConnectConfig): vscode.Terminal {
    const terminal = vscode.window.createTerminal({
      name: `RemoteForge: ${state.profileName}`,
      pty: new RemoteSshPseudoterminal(connect, state.remoteRoot)
    });
    terminal.show();
    this.delegateTerminals.push(terminal);
    return terminal;
  }

  private async setDefaultTerminalProfile(context: vscode.ExtensionContext, profileId: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('terminal.integrated');
    const profileKey = defaultProfileSettingKey();
    const current = config.get<string>(profileKey);
    if (current !== profileId) {
      await context.workspaceState.update(PREVIOUS_PROFILE_KEY, current);
      await config.update(profileKey, profileId, vscode.ConfigurationTarget.Workspace);
    }
  }

  private async restoreDefaultTerminalProfile(context: vscode.ExtensionContext): Promise<void> {
    const previous = context.workspaceState.get<string | undefined>(PREVIOUS_PROFILE_KEY);
    const profileKey = defaultProfileSettingKey();
    const config = vscode.workspace.getConfiguration('terminal.integrated');
    if (previous === undefined) {
      await config.update(profileKey, undefined, vscode.ConfigurationTarget.Workspace);
    } else {
      await config.update(profileKey, previous, vscode.ConfigurationTarget.Workspace);
    }
    await context.workspaceState.update(PREVIOUS_PROFILE_KEY, undefined);
  }
}

const PREVIOUS_PROFILE_KEY = 'remoteforge.previousTerminalProfile';

export { delegateTerminalProfileId };
