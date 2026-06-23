import * as vscode from 'vscode';
import { openConfigPanel } from './ui/webview/ConfigPanel';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('remoteforge.openConfig', () => {
      openConfigPanel(context);
    }),
    vscode.commands.registerCommand('remoteforge.refreshExplorer', () => undefined)
  );
}

export function deactivate(): void {}
