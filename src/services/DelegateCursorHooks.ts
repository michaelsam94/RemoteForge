import * as fs from 'fs';
import * as path from 'path';
import { DelegateHookConfig } from '../core/delegate/buildRemoteShellCommand';

const HOOK_SCRIPT_NAME = 'remoteforge-delegate-shell.js';
const HOOK_COMMAND = `.cursor/hooks/${HOOK_SCRIPT_NAME}`;
const HOOKS_JSON = 'hooks.json';

interface CursorHooksFile {
  version: number;
  hooks: Record<string, Array<Record<string, unknown>>>;
}

export class DelegateCursorHooks {
  async install(workspaceRoot: string, config: DelegateHookConfig): Promise<void> {
    const cursorDir = path.join(workspaceRoot, '.cursor');
    const hooksDir = path.join(cursorDir, 'hooks');
    await fs.promises.mkdir(hooksDir, { recursive: true });
    await fs.promises.mkdir(path.join(workspaceRoot, '.remoteforge'), { recursive: true });

    await fs.promises.writeFile(
      path.join(workspaceRoot, '.remoteforge', 'delegate-hook.json'),
      `${JSON.stringify(config, null, 2)}\n`
    );
    await fs.promises.writeFile(
      path.join(hooksDir, HOOK_SCRIPT_NAME),
      buildHookScript(),
      { mode: 0o755 }
    );
    await mergeHooksJson(cursorDir);
  }

  async uninstall(workspaceRoot: string): Promise<void> {
    await removeFileIfExists(path.join(workspaceRoot, '.remoteforge', 'delegate-hook.json'));
    await removeFileIfExists(path.join(workspaceRoot, '.cursor', 'hooks', HOOK_SCRIPT_NAME));
    await removeRemoteForgeHook(path.join(workspaceRoot, '.cursor', HOOKS_JSON));
  }
}

function buildHookScript(): string {
  return `#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

function shellQuote(value) {
  return "'" + String(value).replace(/'/g, "'\\\\''") + "'";
}

function buildRemoteShellCommand(config, command) {
  const remotePayload = 'cd ' + config.remoteRoot + ' && ' + command;
  return [
    'ssh',
    '-S',
    shellQuote(config.controlPath),
    '-p',
    String(config.port),
    '-o',
    'StrictHostKeyChecking=accept-new',
    '-o',
    'BatchMode=yes',
    config.userAtHost,
    shellQuote(remotePayload)
  ].join(' ');
}

function readInput() {
  try {
    return JSON.parse(fs.readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

const input = readInput();
const command = input.tool_input?.command ?? input.command ?? '';
const configPath = path.join(process.cwd(), '.remoteforge', 'delegate-hook.json');

if (!command || !fs.existsSync(configPath)) {
  process.stdout.write(JSON.stringify({ permission: 'allow' }));
  process.exit(0);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
process.stdout.write(JSON.stringify({
  permission: 'allow',
  updated_input: {
    command: buildRemoteShellCommand(config, command)
  }
}));
`;
}

async function mergeHooksJson(cursorDir: string): Promise<void> {
  const hooksJsonPath = path.join(cursorDir, HOOKS_JSON);
  const existing = await readHooksJson(hooksJsonPath);
  const preToolUse = existing.hooks.preToolUse ?? [];
  const withoutRemoteForge = preToolUse.filter(entry => entry.command !== HOOK_COMMAND);
  existing.hooks.preToolUse = [
    {
      command: HOOK_COMMAND,
      matcher: 'Shell'
    },
    ...withoutRemoteForge
  ];
  await fs.promises.writeFile(hooksJsonPath, `${JSON.stringify(existing, null, 2)}\n`);
}

async function removeRemoteForgeHook(hooksJsonPath: string): Promise<void> {
  if (!fs.existsSync(hooksJsonPath)) {
    return;
  }

  const existing = await readHooksJson(hooksJsonPath);
  const preToolUse = (existing.hooks.preToolUse ?? []).filter(entry => entry.command !== HOOK_COMMAND);
  if (preToolUse.length > 0) {
    existing.hooks.preToolUse = preToolUse;
    await fs.promises.writeFile(hooksJsonPath, `${JSON.stringify(existing, null, 2)}\n`);
    return;
  }

  delete existing.hooks.preToolUse;
  if (Object.keys(existing.hooks).length === 0) {
    await removeFileIfExists(hooksJsonPath);
    return;
  }

  await fs.promises.writeFile(hooksJsonPath, `${JSON.stringify(existing, null, 2)}\n`);
}

async function readHooksJson(hooksJsonPath: string): Promise<CursorHooksFile> {
  if (!fs.existsSync(hooksJsonPath)) {
    return { version: 1, hooks: {} };
  }

  try {
    const parsed = JSON.parse(await fs.promises.readFile(hooksJsonPath, 'utf8')) as CursorHooksFile;
    parsed.version = parsed.version ?? 1;
    parsed.hooks = parsed.hooks ?? {};
    return parsed;
  } catch {
    return { version: 1, hooks: {} };
  }
}

async function removeFileIfExists(filePath: string): Promise<void> {
  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
  }
}
