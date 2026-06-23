import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('remoteforge.openConfig', () => {
      void vscode.window.showInformationMessage('RemoteForge configuration will open here.');
    }),
    vscode.commands.registerCommand('remoteforge.refreshExplorer', () => undefined)
  );
}

export function deactivate(): void {}
