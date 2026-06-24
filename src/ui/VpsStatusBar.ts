import * as vscode from 'vscode';
import { VpsWorkspaceService } from '../services/VpsWorkspaceService';

export function createVpsStatusBar(workspaceService: VpsWorkspaceService): vscode.StatusBarItem {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'remoteforge.showDelegateMenu';
  updateVpsStatusBar(statusBarItem, workspaceService.getState());
  workspaceService.onDidChange(state => updateVpsStatusBar(statusBarItem, state));
  statusBarItem.show();
  return statusBarItem;
}

function updateVpsStatusBar(
  statusBarItem: vscode.StatusBarItem,
  state: ReturnType<VpsWorkspaceService['getState']>
): void {
  if (!state?.enabled) {
    statusBarItem.text = '$(cloud-upload) RemoteForge: Local';
    statusBarItem.tooltip = 'Delegate mode is off. Click to enable or open settings.';
    return;
  }

  statusBarItem.text = `$(server) RemoteForge: ${state.profileName}`;
  statusBarItem.tooltip = `Delegate mode ON at ${state.remoteRoot}\nClick to sync, open terminal, or disable.`;
}
