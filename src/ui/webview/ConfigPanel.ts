import * as crypto from 'crypto';
import * as vscode from 'vscode';
import { ConfigStoreAdapter } from '../../adapters/ConfigStoreAdapter';
import { SecretStoreAdapter } from '../../adapters/SecretStoreAdapter';
import { testProfileConnection } from '../../core/connection/SshConnectionTester';
import { ProfileManager } from '../../core/profile/ProfileManager';
import { VpsProfile, VpsProfileDraft } from '../../core/profile/ProfileTypes';
import { VpsWorkspaceService } from '../../services/VpsWorkspaceService';
import { renderConfigPanelHtml } from './ConfigPanelHtml';

let activePanel: vscode.WebviewPanel | undefined;
let activeProfileManager: ProfileManager | undefined;

export function openConfigPanel(
  context: vscode.ExtensionContext,
  workspaceService?: VpsWorkspaceService
): void {
  if (activePanel && activeProfileManager) {
    activePanel.reveal(vscode.ViewColumn.One);
    void sendProfiles(activePanel, activeProfileManager);
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
  const profileManager = new ProfileManager(
    new ConfigStoreAdapter(context.globalState),
    new SecretStoreAdapter(context.secrets),
    () => crypto.randomUUID(),
    () => new Date().toISOString()
  );
  activeProfileManager = profileManager;

  panel.webview.html = renderConfigPanelHtml(createNonce());
  panel.onDidDispose(() => {
    activePanel = undefined;
    activeProfileManager = undefined;
  });

  panel.webview.onDidReceiveMessage((message: unknown) => {
    void handleConfigMessage(panel, profileManager, message, workspaceService);
  });
}

function createNonce(): string {
  return crypto.randomBytes(16).toString('hex');
}

async function sendProfiles(panel: vscode.WebviewPanel, profileManager: ProfileManager): Promise<void> {
  const profiles = await profileManager.listProfiles();
  await panel.webview.postMessage({ type: 'profilesLoaded', profiles: profiles.map(toProfileSummary) });
}

function toProfileSummary(profile: VpsProfile) {
  return {
    id: profile.id,
    name: profile.name,
    host: profile.host,
    port: profile.port,
    username: profile.username,
    authMethod: profile.authMethod,
    defaultWorkdir: profile.defaultWorkdir,
    scripts: profile.scripts,
    updatedAt: profile.updatedAt
  };
}

async function handleConfigMessage(
  panel: vscode.WebviewPanel,
  profileManager: ProfileManager,
  message: unknown,
  workspaceService?: VpsWorkspaceService
): Promise<void> {
  if (isMessage(message, 'requestProfiles')) {
    await sendProfiles(panel, profileManager);
    return;
  }

  if (isProfileMessage(message, 'saveProfile')) {
    try {
      const profile = await profileManager.createProfile(message.profile);
      await sendProfiles(panel, profileManager);
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

  if (isSavedProfileMessage(message, 'testSavedProfile')) {
    const result = await profileManager.testSavedProfile(message.profileId);
    await panel.webview.postMessage({ type: 'testResult', ok: result.ok, message: result.message });
  }

  if (isSavedScriptMessage(message, 'runSavedScript')) {
    try {
      const result = await profileManager.runSavedScript(message.profileId, message.scriptId);
      const profile = (await profileManager.listProfiles()).find(entry => entry.id === message.profileId);
      const script = profile?.scripts.find(entry => entry.id === message.scriptId);
      await panel.webview.postMessage({
        type: 'runResult',
        ok: result.exitCode === 0,
        message: formatRunResult(script?.command ?? 'script', result)
      });
    } catch (error) {
      await panel.webview.postMessage({ type: 'runResult', ok: false, message: messageFromError(error) });
    }
  }

  if (isSavedProfileMessage(message, 'deleteProfile')) {
    const profiles = await profileManager.listProfiles();
    const profile = profiles.find(entry => entry.id === message.profileId);
    if (!profile) {
      await panel.webview.postMessage({ type: 'deleteResult', ok: false, message: 'Profile not found.' });
      return;
    }

    const confirmed = await vscode.window.showWarningMessage(
      `Delete VPS profile "${profile.name}"? Stored credentials will be removed.`,
      { modal: true },
      'Delete Profile'
    );

    if (confirmed !== 'Delete Profile') {
      return;
    }

    try {
      await profileManager.deleteProfile(message.profileId);
      if (workspaceService?.getState()?.profileId === message.profileId) {
        await workspaceService.disable();
      }
      await sendProfiles(panel, profileManager);
      await panel.webview.postMessage({
        type: 'deleteResult',
        ok: true,
        message: `Deleted profile "${profile.name}".`
      });
      void vscode.window.showInformationMessage(`RemoteForge deleted profile "${profile.name}".`);
    } catch (error) {
      await panel.webview.postMessage({ type: 'deleteResult', ok: false, message: messageFromError(error) });
    }
  }
}

function isMessage(message: unknown, type: string): message is { type: string } {
  return message !== null && typeof message === 'object' && 'type' in message && message.type === type;
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

function isSavedProfileMessage(
  message: unknown,
  type: 'testSavedProfile' | 'deleteProfile'
): message is { type: 'testSavedProfile' | 'deleteProfile'; profileId: string } {
  return isMessage(message, type)
    && 'profileId' in message
    && typeof message.profileId === 'string';
}

function isSavedScriptMessage(
  message: unknown,
  type: 'runSavedScript'
): message is { type: 'runSavedScript'; profileId: string; scriptId: string } {
  return isMessage(message, type)
    && 'profileId' in message
    && typeof message.profileId === 'string'
    && 'scriptId' in message
    && typeof message.scriptId === 'string';
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
