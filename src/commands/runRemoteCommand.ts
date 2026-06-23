import * as vscode from 'vscode';
import { ProfileManager } from '../core/profile/ProfileManager';

export async function runRemoteCommand(profileManager: ProfileManager): Promise<void> {
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
        const outputChannel = getOutputChannel();
        outputChannel.clear();
        outputChannel.appendLine(`Profile: ${selected.label}`);
        outputChannel.appendLine(`Command: ${command.trim()}`);
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
          await vscode.window.showInformationMessage(`RemoteForge finished "${command.trim()}" on ${selected.label}.`);
        } else {
          await vscode.window.showErrorMessage(
            `RemoteForge command failed on ${selected.label} with exit code ${result.exitCode ?? 'unknown'}.`
          );
        }
      } catch (error) {
        await vscode.window.showErrorMessage(messageFromError(error));
      }
    }
  );
}

let outputChannel: vscode.OutputChannel | undefined;

function getOutputChannel(): vscode.OutputChannel {
  outputChannel ??= vscode.window.createOutputChannel('RemoteForge');
  return outputChannel;
}

function messageFromError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
