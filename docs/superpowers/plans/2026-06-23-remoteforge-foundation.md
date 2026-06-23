# RemoteForge Foundation Implementation Plan

**For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax tracking.

**Goal:** Build the initial RemoteForge extension foundation with a tested pure-core slice for profile validation, SSH command parsing, and secret-safe logging.

**Architecture:** The first milestone creates a strict TypeScript extension skeleton and pure core modules with zero `vscode` imports. The VS Code entrypoint stays thin and delegates future behavior to command handlers and core services. Tests target core behavior first so later SSH/UI work can build on stable contracts.

**Tech Stack:** TypeScript 5, VS Code extension API `^1.85.0`, Jest with `ts-jest`, CommonJS output for Node 18 extension host.

---

### Task 1: Test Harness and RED Tests

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `jest.config.cjs`
- Create: `.gitignore`
- Create: `src/test/unit/parseSshCommand.test.ts`
- Create: `src/test/unit/ProfileManager.test.ts`
- Create: `src/test/unit/Logger.test.ts`

- [x] **Step 1: Add TypeScript/Jest project files**

```json
{
  "name": "remoteforge",
  "displayName": "RemoteForge",
  "publisher": "remoteforge",
  "version": "0.0.1",
  "engines": {
    "vscode": "^1.85.0"
  },
  "main": "./dist/extension.js",
  "scripts": {
    "compile": "tsc -p .",
    "lint": "eslint src --ext .ts",
    "test:unit": "jest --runInBand",
    "package": "vsce package",
    "audit": "npm audit --audit-level=high"
  },
  "devDependencies": {
    "@types/jest": "^29.5.14",
    "@types/node": "^18.19.0",
    "@types/vscode": "^1.85.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.5",
    "typescript": "^5.6.3"
  }
}
```

- [x] **Step 2: Write failing SSH parser tests**

```typescript
import { parseSshCommand } from '../../core/ssh/parseSshCommand';

describe('parseSshCommand', () => {
  it('extracts user, host, port, key path, and jump host from a raw ssh command', () => {
    expect(parseSshCommand('ssh -i ~/.ssh/id_ed25519 -p 2222 -J jump@example.net deploy@203.0.113.10')).toEqual({
      host: '203.0.113.10',
      port: 2222,
      username: 'deploy',
      keyPath: '~/.ssh/id_ed25519',
      jumpHost: 'jump@example.net'
    });
  });
});
```

- [x] **Step 3: Write failing profile manager tests**

```typescript
import { InMemoryConfigStore, InMemorySecretStore, ProfileManager } from '../../core/profile/ProfileManager';

describe('ProfileManager', () => {
  it('stores metadata separately from password secrets', async () => {
    const config = new InMemoryConfigStore();
    const secrets = new InMemorySecretStore();
    const manager = new ProfileManager(config, secrets, () => 'profile-1', () => '2026-06-23T00:00:00.000Z');

    const profile = await manager.createProfile({
      name: 'Build VPS',
      host: '203.0.113.10',
      port: 22,
      username: 'deploy',
      authMethod: 'password',
      password: 'super-secret',
      scripts: []
    });

    expect(profile).not.toHaveProperty('password');
    expect(await secrets.get('remoteforge.password.profile-1')).toBe('super-secret');
    expect(config.snapshot()).toEqual([
      expect.objectContaining({
        id: 'profile-1',
        name: 'Build VPS',
        authMethod: 'password'
      })
    ]);
  });
});
```

- [x] **Step 4: Write failing logger redaction tests**

```typescript
import { Logger } from '../../shared/Logger';

describe('Logger', () => {
  it('redacts registered secrets before writing logs', () => {
    const lines: string[] = [];
    const logger = new Logger({ write: line => lines.push(line) }, 'debug', () => '2026-06-23T00:00:00.000Z');

    logger.registerSecret('super-secret');
    logger.info('connecting with super-secret');

    expect(lines[0]).toContain('[INFO]');
    expect(lines[0]).toContain('[REDACTED]');
    expect(lines[0]).not.toContain('super-secret');
  });
});
```

- [x] **Step 5: Run tests verify RED**

Run: `npm test -- --runInBand`

Expected: FAIL because `parseSshCommand`, `ProfileManager`, and `Logger` modules do not exist yet.

### Task 2: Minimal Core Implementation

**Files:**
- Create: `src/core/ssh/parseSshCommand.ts`
- Create: `src/core/profile/ProfileTypes.ts`
- Create: `src/core/profile/ProfileManager.ts`
- Create: `src/shared/Logger.ts`

- [x] **Step 1: Implement `parseSshCommand` minimally**

```typescript
export interface ParsedSshCommand {
  host: string;
  port: number;
  username: string;
  keyPath?: string;
  jumpHost?: string;
}

export function parseSshCommand(command: string): ParsedSshCommand {
  const tokens = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(token => token.replace(/^["']|["']$/g, '')) ?? [];
  if (tokens[0] !== 'ssh') {
    throw new Error('SSH command must start with ssh');
  }

  let port = 22;
  let keyPath: string | undefined;
  let jumpHost: string | undefined;
  let usernameHost: string | undefined;

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === '-i') {
      keyPath = tokens[++index];
    } else if (token === '-p') {
      port = Number(tokens[++index]);
    } else if (token === '-J') {
      jumpHost = tokens[++index];
    } else if (!token.startsWith('-')) {
      usernameHost = token;
    }
  }

  const match = usernameHost?.match(/^(?<username>[^@\s]+)@(?<host>[^\s]+)$/);
  if (!match?.groups) {
    throw new Error('SSH command must include user@host');
  }

  return { host: match.groups.host, port, username: match.groups.username, keyPath, jumpHost };
}
```

- [x] **Step 2: Implement profile manager and memory stores**

```typescript
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
  async getProfiles(): Promise<VpsProfile[]> { return [...this.profiles]; }
  async saveProfiles(profiles: VpsProfile[]): Promise<void> { this.profiles = profiles.map(profile => ({ ...profile })); }
  snapshot(): VpsProfile[] { return [...this.profiles]; }
}

export class InMemorySecretStore implements SecretStore {
  private values = new Map<string, string>();
  async get(key: string): Promise<string | undefined> { return this.values.get(key); }
  async set(key: string, value: string): Promise<void> { this.values.set(key, value); }
}

export class ProfileManager {
  constructor(private readonly config: ConfigStore, private readonly secrets: SecretStore, private readonly createId: () => string, private readonly now: () => string) {}

  async createProfile(draft: VpsProfileDraft): Promise<VpsProfile> {
    const existing = await this.config.getProfiles();
    const id = this.createId();
    const profile: VpsProfile = {
      id,
      name: draft.name.trim(),
      host: draft.host.trim(),
      port: draft.port,
      username: draft.username.trim(),
      authMethod: draft.authMethod,
      scripts: draft.scripts ?? [],
      createdAt: this.now(),
      updatedAt: this.now()
    };

    await this.secrets.set(`remoteforge.password.${id}`, draft.password ?? '');
    await this.config.saveProfiles([...existing, profile]);
    return profile;
  }
}
```

- [x] **Step 3: Implement logger redaction**

```typescript
export interface LogSink {
  write(line: string): void;
}

export type LogLevel = 'off' | 'error' | 'warn' | 'info' | 'debug';

export class Logger {
  private readonly secrets = new Set<string>();

  constructor(private readonly sink: LogSink, private readonly level: LogLevel = 'info', private readonly now: () => string = () => new Date().toISOString()) {}

  registerSecret(value: string): void {
    if (value) this.secrets.add(value);
  }

  info(message: string): void {
    this.write('info', message);
  }

  private write(level: Exclude<LogLevel, 'off'>, message: string): void {
    if (this.level === 'off') return;
    this.sink.write(`[${this.now()}] [${level.toUpperCase()}] ${this.redact(message)}`);
  }

  private redact(message: string): string {
    let redacted = message;
    for (const secret of this.secrets) redacted = redacted.split(secret).join('[REDACTED]');
    return redacted;
  }
}
```

- [x] **Step 4: Run tests verify GREEN**

Run: `npm test -- --runInBand`

Expected: PASS.

### Task 3: VS Code Extension Skeleton

**Files:**
- Create: `src/extension.ts`
- Modify: `package.json`

- [x] **Step 1: Add command contributions**

```json
"activationEvents": [
  "onStartupFinished",
  "onView:remoteforgeExplorer"
],
"contributes": {
  "commands": [
    {
      "command": "remoteforge.openConfig",
      "title": "RemoteForge: Open Configuration"
    },
    {
      "command": "remoteforge.refreshExplorer",
      "title": "RemoteForge: Refresh Explorer"
    }
  ]
}
```

- [x] **Step 2: Add thin extension entrypoint**

```typescript
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('remoteforge.openConfig', () => {
      vscode.window.showInformationMessage('RemoteForge configuration will open here.');
    }),
    vscode.commands.registerCommand('remoteforge.refreshExplorer', () => undefined)
  );
}

export function deactivate(): void {}
```

- [x] **Step 3: Compile**

Run: `npm run compile`

Expected: PASS and `dist/extension.js` is generated by `tsc`.

### Task 4: Final Verification

**Files:**
- Read: `docs/ROADMAP.md`
- Read: `docs/superpowers/plans/2026-06-23-remoteforge-foundation.md`

- [x] **Step 1: Run unit tests**

Run: `npm test -- --runInBand`

Expected: PASS.

- [x] **Step 2: Run compile**

Run: `npm run compile`

Expected: PASS.

- [x] **Step 3: Inspect git status**

Run: `git status --short`

Expected: only planned project files are listed.

