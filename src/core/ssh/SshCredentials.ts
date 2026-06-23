import { VpsProfile, VpsProfileDraft } from '../profile/ProfileTypes';

export interface SshConnectConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface ResolvedProfileCredentials {
  profile: VpsProfile;
  connect: SshConnectConfig;
}

export function credentialsFromDraft(draft: VpsProfileDraft): SshConnectConfig {
  const config: SshConnectConfig = {
    host: draft.host.trim(),
    port: draft.port,
    username: draft.username.trim()
  };

  if (draft.authMethod === 'password' && draft.password) {
    config.password = draft.password;
  }

  if (draft.authMethod === 'privateKey') {
    if (draft.privateKeyContent) {
      config.privateKey = draft.privateKeyContent;
    }

    if (draft.privateKeyPassphrase) {
      config.passphrase = draft.privateKeyPassphrase;
    }
  }

  return config;
}

export function credentialsFromProfile(
  profile: VpsProfile,
  secrets: { password?: string; privateKeyContent?: string; privateKeyPassphrase?: string }
): SshConnectConfig {
  const config: SshConnectConfig = {
    host: profile.host,
    port: profile.port,
    username: profile.username
  };

  if (profile.authMethod === 'password' && secrets.password) {
    config.password = secrets.password;
  }

  if (profile.authMethod === 'privateKey') {
    if (secrets.privateKeyContent) {
      config.privateKey = secrets.privateKeyContent;
    }

    if (secrets.privateKeyPassphrase) {
      config.passphrase = secrets.privateKeyPassphrase;
    }
  }

  return config;
}
