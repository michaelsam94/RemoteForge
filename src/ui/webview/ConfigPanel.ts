import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { ConfigStoreAdapter } from '../../adapters/ConfigStoreAdapter';
import { SecretStoreAdapter } from '../../adapters/SecretStoreAdapter';
import { testTcpConnection } from '../../core/connection/ConnectionTester';
import { ProfileManager } from '../../core/profile/ProfileManager';
import { VpsProfileDraft } from '../../core/profile/ProfileTypes';
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

  const profileManager = new ProfileManager(
    new ConfigStoreAdapter(context.globalState),
    new SecretStoreAdapter(context.secrets),
    () => crypto.randomUUID(),
    () => new Date().toISOString()
  );

  panel.webview.onDidReceiveMessage((message: unknown) => {
    void handleConfigMessage(panel, profileManager, message);
  });
}

function createNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

async function handleConfigMessage(
  panel: vscode.WebviewPanel,
  profileManager: ProfileManager,
  message: unknown
): Promise<void> {
  if (isProfileMessage(message, 'saveProfile')) {
    try {
      const profile = await profileManager.createProfile(message.profile);
      await panel.webview.postMessage({
        type: 'saveResult',
        ok: true,
        message: `Saved profile "${profile.name}".`
      });
      void vscode.window.showInformationMessage(`RemoteForge saved profile "${profile.name}".`);
    } catch (error) {
      await panel.webview.postMessage({ type: 'saveResult', ok: false, message: messageFromError(error) });
    }
  }

  if (isProfileMessage(message, 'testConnection')) {
    const result = await testTcpConnection({ host: message.profile.host, port: message.profile.port });
    await panel.webview.postMessage({ type: 'testResult', ok: result.ok, message: result.message });
  }
}

function isProfileMessage(
  message: unknown,
  type: 'saveProfile' | 'testConnection'
): message is { type: 'saveProfile' | 'testConnection'; profile: VpsProfileDraft } {
  return message !== null
    && typeof message === 'object'
    && 'type' in message
    && message.type === type
    && 'profile' in message
    && message.profile !== null
    && typeof message.profile === 'object';
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
