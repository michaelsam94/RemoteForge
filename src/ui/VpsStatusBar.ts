import * as vscode from 'vscode';
import { VpsWorkspaceService } from '../services/VpsWorkspaceService';

export function createVpsStatusBar(workspaceService: VpsWorkspaceService): vscode.StatusBarItem {
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'remoteforge.syncToVps';
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
    statusBarItem.tooltip = 'RemoteForge VPS mode is off. Run "Enable VPS Mode" to clone this workspace to a VPS.';
    statusBarItem.command = 'remoteforge.enableVpsMode';
    return;
  }

  statusBarItem.text = `$(server) RemoteForge: ${state.profileName}`;
  statusBarItem.tooltip = `Working on VPS at ${state.remoteRoot}\nClick to sync local changes to the VPS.`;
  statusBarItem.command = 'remoteforge.syncToVps';
}
