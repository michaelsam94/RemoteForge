import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { ConfigStoreAdapter } from './adapters/ConfigStoreAdapter';
import { SecretStoreAdapter } from './adapters/SecretStoreAdapter';
import { runRemoteCommand } from './commands/runRemoteCommand';
import {
  disableVpsMode,
  enableVpsMode,
  showDelegateModeMenu,
  syncWorkspaceFromVps,
  syncWorkspaceToVps,
  toggleDelegateMode
} from './commands/vpsWorkspace';
import { ProfileManager } from './core/profile/ProfileManager';
import { DelegateTerminalManager, delegateTerminalProfileId } from './services/DelegateTerminalManager';
import { VpsWorkspaceService } from './services/VpsWorkspaceService';
import { createVpsStatusBar } from './ui/VpsStatusBar';
import { openConfigPanel } from './ui/webview/ConfigPanel';

function createProfileManager(context: vscode.ExtensionContext): ProfileManager {
  return new ProfileManager(
    new ConfigStoreAdapter(context.globalState),
    new SecretStoreAdapter(context.secrets),
    () => crypto.randomUUID(),
    () => new Date().toISOString()
  );
}

export function activate(context: vscode.ExtensionContext): void {
  const profileManager = createProfileManager(context);
  const terminalManager = new DelegateTerminalManager();
  const workspaceService = new VpsWorkspaceService(
    context,
    context.workspaceState,
    profileManager,
    terminalManager
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('remoteforge.openConfig', () => {
      openConfigPanel(context, workspaceService, profileManager);
    }),
    vscode.commands.registerCommand('remoteforge.refreshExplorer', () => undefined),
    vscode.commands.registerCommand('remoteforge.runCommand', () => runRemoteCommand(profileManager, workspaceService)),
    vscode.commands.registerCommand('remoteforge.enableVpsMode', () => enableVpsMode(profileManager, workspaceService)),
    vscode.commands.registerCommand('remoteforge.disableVpsMode', () => disableVpsMode(workspaceService)),
    vscode.commands.registerCommand('remoteforge.toggleDelegateMode', () => toggleDelegateMode(profileManager, workspaceService)),
    vscode.commands.registerCommand('remoteforge.showDelegateMenu', () => showDelegateModeMenu(profileManager, workspaceService)),
    vscode.commands.registerCommand('remoteforge.syncToVps', () => syncWorkspaceToVps(workspaceService)),
    vscode.commands.registerCommand('remoteforge.syncFromVps', () => syncWorkspaceFromVps(workspaceService)),
    vscode.commands.registerCommand('remoteforge.openTerminal', () => {
      if (!workspaceService.isEnabled()) {
        void vscode.window.showWarningMessage('Enable RemoteForge delegate mode before opening the VPS terminal.');
        return;
      }

      workspaceService.openDelegateTerminal();
    }),
    vscode.window.registerTerminalProfileProvider(delegateTerminalProfileId, {
      provideTerminalProfile(): vscode.ProviderResult<vscode.TerminalProfile> {
        const state = workspaceService.getState();
        if (!state?.enabled) {
          return undefined;
        }

        return profileManager.getConnectConfig(state.profileId).then(connect =>
          terminalManager.createTerminalProfile(state, connect)
        );
      }
    }),
    vscode.window.onDidOpenTerminal(terminal => {
      if (!workspaceService.isEnabled()) {
        return;
      }

      terminalManager.redirectForeignTerminal(terminal);
    }),
    createVpsStatusBar(workspaceService),
    vscode.workspace.onDidSaveTextDocument(document => {
      void workspaceService.syncSavedFile(document);
    }),
    vscode.workspace.onDidCreateFiles(event => {
      for (const file of event.files) {
        void workspaceService.syncCreatedFile(file);
      }
    })
  );

  void workspaceService.restoreDelegateMode();
}

export function deactivate(): void {}
