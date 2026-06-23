export type AuthMethod = 'password' | 'privateKey' | 'sshCommand';

export interface NamedScript {
  id: string;
  name: string;
  command: string;
  workdir?: string;
  showTerminal: boolean;
  confirmBefore: boolean;
}

export interface JumpHost {
  host: string;
  port: number;
  username: string;
  authMethod: 'password' | 'privateKey';
}

export interface VpsProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: AuthMethod;
  keyPath?: string;
  jumpHost?: JumpHost;
  defaultWorkdir?: string;
  scripts: NamedScript[];
  color?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface VpsProfileDraft {
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: AuthMethod;
  password?: string;
  privateKeyContent?: string;
  privateKeyPassphrase?: string;
  keyPath?: string;
  jumpHost?: JumpHost;
  defaultWorkdir?: string;
  scripts?: NamedScript[];
  color?: string;
  tags?: string[];
}
