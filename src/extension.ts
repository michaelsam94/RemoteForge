import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { ConfigStoreAdapter } from './adapters/ConfigStoreAdapter';
import { SecretStoreAdapter } from './adapters/SecretStoreAdapter';
import { runRemoteCommand } from './commands/runRemoteCommand';
import {
  disableVpsMode,
  enableVpsMode,
  syncWorkspaceFromVps,
  syncWorkspaceToVps
} from './commands/vpsWorkspace';
import { ProfileManager } from './core/profile/ProfileManager';
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
  const workspaceService = new VpsWorkspaceService(context.workspaceState, profileManager);

  context.subscriptions.push(
    vscode.commands.registerCommand('remoteforge.openConfig', () => {
      openConfigPanel(context, workspaceService);
    }),
    vscode.commands.registerCommand('remoteforge.refreshExplorer', () => undefined),
    vscode.commands.registerCommand('remoteforge.runCommand', () => runRemoteCommand(profileManager, workspaceService)),
    vscode.commands.registerCommand('remoteforge.enableVpsMode', () => enableVpsMode(profileManager, workspaceService)),
    vscode.commands.registerCommand('remoteforge.disableVpsMode', () => disableVpsMode(workspaceService)),
    vscode.commands.registerCommand('remoteforge.syncToVps', () => syncWorkspaceToVps(workspaceService)),
    vscode.commands.registerCommand('remoteforge.syncFromVps', () => syncWorkspaceFromVps(workspaceService)),
    createVpsStatusBar(workspaceService),
    vscode.workspace.onDidSaveTextDocument(document => {
      void workspaceService.syncSavedFile(document);
    })
  );
}

export function deactivate(): void {}
