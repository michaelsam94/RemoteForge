import * as vscode from 'vscode';
import { SecretStore } from '../core/profile/ProfileManager';

export class SecretStoreAdapter implements SecretStore {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async get(key: string): Promise<string | undefined> {
    return this.secrets.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    await this.secrets.store(key, value);
  }
}
