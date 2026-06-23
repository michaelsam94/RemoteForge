import { credentialsFromDraft, credentialsFromProfile } from '../ssh/SshCredentials';
import { execRemoteCommand, RemoteExecResult } from '../ssh/SshExecutor';
import { VpsProfile, VpsProfileDraft } from './ProfileTypes';

export interface ConfigStore {
  getProfiles(): Promise<VpsProfile[]>;
  saveProfiles(profiles: VpsProfile[]): Promise<void>;
}

export interface SecretStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
}

export class InMemoryConfigStore implements ConfigStore {
  private profiles: VpsProfile[] = [];

  getProfiles(): Promise<VpsProfile[]> {
    return Promise.resolve(this.profiles.map(profile => ({ ...profile })));
  }

  saveProfiles(profiles: VpsProfile[]): Promise<void> {
    this.profiles = profiles.map(profile => ({ ...profile }));
    return Promise.resolve();
  }

  snapshot(): VpsProfile[] {
    return this.profiles.map(profile => ({ ...profile }));
  }
}

export class InMemorySecretStore implements SecretStore {
  private readonly values = new Map<string, string>();

  get(key: string): Promise<string | undefined> {
    return Promise.resolve(this.values.get(key));
  }

  set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }
}

export class ProfileManager {
  constructor(
    private readonly config: ConfigStore,
    private readonly secrets: SecretStore,
    private readonly createId: () => string,
    private readonly now: () => string
  ) {}

  async listProfiles(): Promise<VpsProfile[]> {
    return this.config.getProfiles();
  }

  async createProfile(draft: VpsProfileDraft): Promise<VpsProfile> {
    const existing = await this.config.getProfiles();
    const name = draft.name.trim();
    const host = draft.host.trim();
    const username = draft.username.trim();

    validateProfileDraft({ ...draft, name, host, username }, existing);

    const id = this.createId();
    const timestamp = this.now();
    const profile: VpsProfile = {
      id,
      name,
      host,
      port: draft.port,
      username,
      authMethod: draft.authMethod,
      scripts: draft.scripts ?? [],
      createdAt: timestamp,
      updatedAt: timestamp,
      ...(draft.keyPath ? { keyPath: draft.keyPath } : {}),
      ...(draft.jumpHost ? { jumpHost: draft.jumpHost } : {}),
      ...(draft.defaultWorkdir ? { defaultWorkdir: draft.defaultWorkdir } : {}),
      ...(draft.color ? { color: draft.color } : {}),
      ...(draft.tags ? { tags: draft.tags } : {})
    };

    await this.storeSecrets(id, draft);
    await this.config.saveProfiles([...existing, profile]);

    return profile;
  }

  async execOnDraft(draft: VpsProfileDraft, command: string, cwd?: string): Promise<RemoteExecResult> {
    if (draft.authMethod === 'sshCommand') {
      throw new Error('SSH command auth is not supported for delegated execution yet');
    }

    const connect = credentialsFromDraft(draft);
    const workdir = cwd ?? draft.defaultWorkdir;
    return execRemoteCommand(connect, command, workdir);
  }

  async execOnProfile(profileId: string, command: string, cwd?: string): Promise<RemoteExecResult> {
    const profiles = await this.config.getProfiles();
    const profile = profiles.find(entry => entry.id === profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    if (profile.authMethod === 'sshCommand') {
      throw new Error('SSH command auth is not supported for delegated execution yet');
    }

    const secrets = await this.readSecrets(profile.id, profile.authMethod);
    const connect = credentialsFromProfile(profile, secrets);
    const workdir = cwd ?? profile.defaultWorkdir;
    return execRemoteCommand(connect, command, workdir);
  }

  private async readSecrets(
    profileId: string,
    authMethod: VpsProfile['authMethod']
  ): Promise<{ password?: string; privateKeyContent?: string; privateKeyPassphrase?: string }> {
    if (authMethod === 'password') {
      return { password: await this.secrets.get(`remoteforge.password.${profileId}`) };
    }

    if (authMethod === 'privateKey') {
      return {
        privateKeyContent: await this.secrets.get(`remoteforge.privateKeyContent.${profileId}`),
        privateKeyPassphrase: await this.secrets.get(`remoteforge.privateKeyPassphrase.${profileId}`)
      };
    }

    return {};
  }

  private async storeSecrets(profileId: string, draft: VpsProfileDraft): Promise<void> {
    if (draft.authMethod === 'password' && draft.password) {
      await this.secrets.set(`remoteforge.password.${profileId}`, draft.password);
    }

    if (draft.authMethod === 'privateKey') {
      if (draft.privateKeyContent) {
        await this.secrets.set(`remoteforge.privateKeyContent.${profileId}`, draft.privateKeyContent);
      }

      if (draft.privateKeyPassphrase) {
        await this.secrets.set(`remoteforge.privateKeyPassphrase.${profileId}`, draft.privateKeyPassphrase);
      }
    }
  }
}

function validateProfileDraft(draft: VpsProfileDraft, existing: VpsProfile[]): void {
  if (!draft.name) {
    throw new Error('Profile name is required');
  }

  if (draft.name.length > 48) {
    throw new Error('Profile name must be 48 characters or fewer');
  }

  if (existing.some(profile => profile.name.toLocaleLowerCase() === draft.name.toLocaleLowerCase())) {
    throw new Error('Profile name must be unique');
  }

  if (!draft.host) {
    throw new Error('Host is required');
  }

  if (!draft.username) {
    throw new Error('Username is required');
  }

  if (!Number.isInteger(draft.port) || draft.port < 1 || draft.port > 65535) {
    throw new Error('Port must be between 1 and 65535');
  }
}
