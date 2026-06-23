import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { renderConfigPanelHtml } from './ConfigPanelHtml';

let activePanel: vscode.WebviewPanel | undefined;

export function openConfigPanel(context: vscode.ExtensionContext): void {
  if (activePanel) {
    activePanel.reveal(vscode.ViewColumn.One);
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'remoteforgeConfig',
    'RemoteForge Configuration',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
    }
  );

  activePanel = panel;
  panel.webview.html = renderConfigPanelHtml(createNonce());
  panel.onDidDispose(() => {
    activePanel = undefined;
  });

  panel.webview.onDidReceiveMessage((message: unknown) => {
    if (isNoticeMessage(message)) {
      void vscode.window.showInformationMessage('RemoteForge profile saving is planned for the next milestone.');
    }
  });
}

function createNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

function isNoticeMessage(message: unknown): message is { type: 'notice' } {
  return message !== null && typeof message === 'object' && 'type' in message && message.type === 'notice';
}
