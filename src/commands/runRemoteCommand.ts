import * as vscode from 'vscode';
import { ProfileManager } from '../core/profile/ProfileManager';
import { VpsWorkspaceService } from '../services/VpsWorkspaceService';

export async function runRemoteCommand(
  profileManager: ProfileManager,
  workspaceService: VpsWorkspaceService
): Promise<void> {
  if (workspaceService.isEnabled()) {
    const state = workspaceService.getState();
    const command = await vscode.window.showInputBox({
      value: 'npm test',
      prompt: `Command to run in ${state?.remoteRoot ?? 'the remote workspace'}`
    });

    if (!command?.trim()) {
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: `RemoteForge: running in VPS workspace`,
        cancellable: false
      },
      async () => {
        try {
          const result = await workspaceService.execInWorkspace(command.trim());
          showCommandOutput(state?.profileName ?? 'VPS', command.trim(), result);
        } catch (error) {
          await vscode.window.showErrorMessage(messageFromError(error));
        }
      }
    );
    return;
  }

  const profiles = await profileManager.listProfiles();
  if (profiles.length === 0) {
    await vscode.window.showWarningMessage('RemoteForge has no saved VPS profiles. Open configuration to add one.');
    return;
  }

  const selected = await vscode.window.showQuickPick(
    profiles.map(profile => ({
      label: profile.name,
      description: `${profile.username}@${profile.host}:${profile.port}`,
      profileId: profile.id
    })),
    { placeHolder: 'Select a VPS profile to run a command on' }
  );

  if (!selected) {
    return;
  }

  const command = await vscode.window.showInputBox({
    placeHolder: 'uname -a',
    prompt: 'Command to run on the remote VPS'
  });

  if (!command?.trim()) {
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `RemoteForge: running on ${selected.label}`,
      cancellable: false
    },
    async () => {
      try {
        const result = await profileManager.execOnProfile(selected.profileId, command.trim());
        showCommandOutput(selected.label, command.trim(), result);
      } catch (error) {
        await vscode.window.showErrorMessage(messageFromError(error));
      }
    }
  );
}

function showCommandOutput(
  profileLabel: string,
  command: string,
  result: { exitCode: number | null; stdout: string; stderr: string }
): void {
  const outputChannel = getOutputChannel();
  outputChannel.clear();
  outputChannel.appendLine(`Profile: ${profileLabel}`);
  outputChannel.appendLine(`Command: ${command}`);
  outputChannel.appendLine(`Exit code: ${result.exitCode ?? 'unknown'}`);
  if (result.stdout) {
    outputChannel.appendLine('');
    outputChannel.appendLine('stdout:');
    outputChannel.appendLine(result.stdout.trimEnd());
  }
  if (result.stderr) {
    outputChannel.appendLine('');
    outputChannel.appendLine('stderr:');
    outputChannel.appendLine(result.stderr.trimEnd());
  }
  outputChannel.show(true);

  if (result.exitCode === 0) {
    void vscode.window.showInformationMessage(`RemoteForge finished "${command}" on ${profileLabel}.`);
  } else {
    void vscode.window.showErrorMessage(
      `RemoteForge command failed on ${profileLabel} with exit code ${result.exitCode ?? 'unknown'}.`
    );
  }
}

let outputChannel: vscode.OutputChannel | undefined;

function getOutputChannel(): vscode.OutputChannel {
  outputChannel ??= vscode.window.createOutputChannel('RemoteForge');
  return outputChannel;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
