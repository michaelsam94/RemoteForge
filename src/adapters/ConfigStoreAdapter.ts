import * as vscode from 'vscode';
import { ConfigStore } from '../core/profile/ProfileManager';
import { VpsProfile } from '../core/profile/ProfileTypes';

const profilesKey = 'remoteforge.profiles';

export class ConfigStoreAdapter implements ConfigStore {
  constructor(private readonly state: vscode.Memento) {}

  getProfiles(): Promise<VpsProfile[]> {
    return Promise.resolve(this.state.get<VpsProfile[]>(profilesKey, []));
  }

  async saveProfiles(profiles: VpsProfile[]): Promise<void> {
    await this.state.update(profilesKey, profiles);
  }
}
