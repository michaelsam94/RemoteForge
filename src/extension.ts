import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { ConfigStoreAdapter } from './adapters/ConfigStoreAdapter';
import { SecretStoreAdapter } from './adapters/SecretStoreAdapter';
import { runRemoteCommand } from './commands/runRemoteCommand';
import { ProfileManager } from './core/profile/ProfileManager';
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

  context.subscriptions.push(
    vscode.commands.registerCommand('remoteforge.openConfig', () => {
      openConfigPanel(context);
    }),
    vscode.commands.registerCommand('remoteforge.refreshExplorer', () => undefined),
    vscode.commands.registerCommand('remoteforge.runCommand', () => runRemoteCommand(profileManager))
  );
}

export function deactivate(): void {}
