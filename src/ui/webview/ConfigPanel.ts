import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { ConfigStoreAdapter } from '../../adapters/ConfigStoreAdapter';
import { SecretStoreAdapter } from '../../adapters/SecretStoreAdapter';
import { testProfileConnection } from '../../core/connection/SshConnectionTester';
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
    const result = await testProfileConnection(message.profile);
    await panel.webview.postMessage({ type: 'testResult', ok: result.ok, message: result.message });
  }

  if (isProfileMessage(message, 'runScript')) {
    try {
      const script = message.profile.scripts?.[0];
      if (!script) {
        throw new Error('Add a quick-run script command before running it.');
      }

      const result = await profileManager.execOnDraft(message.profile, script.command, script.workdir);
      await panel.webview.postMessage({
        type: 'runResult',
        ok: result.exitCode === 0,
        message: formatRunResult(script.command, result)
      });
    } catch (error) {
      await panel.webview.postMessage({ type: 'runResult', ok: false, message: messageFromError(error) });
    }
  }
}

function isProfileMessage(
  message: unknown,
  type: 'saveProfile' | 'testConnection' | 'runScript'
): message is { type: 'saveProfile' | 'testConnection' | 'runScript'; profile: VpsProfileDraft } {
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

function formatRunResult(command: string, result: { exitCode: number | null; stdout: string; stderr: string }): string {
  const parts = [`Command "${command}" finished with exit code ${result.exitCode ?? 'unknown'}.`];
  if (result.stdout.trim()) {
    parts.push(`stdout: ${result.stdout.trim()}`);
  }
  if (result.stderr.trim()) {
    parts.push(`stderr: ${result.stderr.trim()}`);
  }
  return parts.join(' ');
}
