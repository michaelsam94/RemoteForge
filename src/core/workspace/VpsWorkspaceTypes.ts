export interface VpsWorkspaceState {
  enabled: boolean;
  profileId: string;
  profileName: string;
  localRoot: string;
  remoteRoot: string;
  lastSyncedAt?: string;
}

export const VPS_WORKSPACE_STATE_KEY = 'remoteforge.vpsWorkspaceState';
