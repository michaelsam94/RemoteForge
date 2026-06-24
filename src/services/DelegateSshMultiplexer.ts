import { execFile, spawn } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { DelegateHookConfig } from '../core/delegate/buildRemoteShellCommand';
import { SshConnectConfig } from '../core/ssh/SshCredentials';
import { isCommandAvailable, isWindowsPlatform, nullDevicePath } from '../core/sync/syncPlatform';

const execFileAsync = promisify(execFile);

export class DelegateSshMultiplexer {
  private hookConfig?: DelegateHookConfig;

  getConfig(): DelegateHookConfig | undefined {
    return this.hookConfig;
  }

  async start(
    connect: SshConnectConfig,
    workspaceRoot: string,
    remoteRoot: string
  ): Promise<DelegateHookConfig> {
    await this.stop();

    const sshDir = path.join(workspaceRoot, '.remoteforge', 'ssh');
    await fs.promises.mkdir(sshDir, { recursive: true });

    const controlPath = path.join(sshDir, 'control');
    const userAtHost = `${connect.username}@${connect.host}`;
    const sshArgs = [
      '-M',
      '-S',
      controlPath,
      '-p',
      String(connect.port),
      '-o',
      'StrictHostKeyChecking=accept-new',
      '-o',
      `UserKnownHostsFile=${nullDevicePath()}`,
      '-o',
      'ControlPersist=30m',
      userAtHost,
      '-N',
      '-f'
    ];

    const env: NodeJS.ProcessEnv = { ...process.env };
    const cleanupTasks: Array<() => void | Promise<void>> = [];

    if (connect.privateKey) {
      const keyPath = path.join(sshDir, 'id');
      await fs.promises.writeFile(keyPath, connect.privateKey, { mode: 0o600 });
      cleanupTasks.push(async () => removeFileIfExists(keyPath));
      sshArgs.splice(-2, 0, '-i', keyPath);
    }

    let command = 'ssh';
    let prefixArgs: string[] = [];

    if (connect.password && !connect.privateKey) {
      if (!isWindowsPlatform() && await isCommandAvailable('sshpass')) {
        command = 'sshpass';
        prefixArgs = ['-e'];
        env.SSHPASS = connect.password;
        cleanupTasks.push(() => {
          delete env.SSHPASS;
        });
      } else {
        const askPassPath = await createAskPassScript(connect.password, env, cleanupTasks);
        env.SSH_ASKPASS = askPassPath;
        env.SSH_ASKPASS_REQUIRE = 'force';
        if (!isWindowsPlatform()) {
          env.DISPLAY = env.DISPLAY ?? ':0';
        }
      }
    }

    try {
      await spawnSshMaster(command, prefixArgs, sshArgs, env);
    } finally {
      for (const task of cleanupTasks) {
        await task();
      }
    }

    this.hookConfig = {
      controlPath,
      userAtHost,
      port: connect.port,
      remoteRoot
    };
    return this.hookConfig;
  }

  async stop(): Promise<void> {
    const config = this.hookConfig;
    this.hookConfig = undefined;
    if (!config) {
      return;
    }

    try {
      await execFileAsync('ssh', [
        '-S',
        config.controlPath,
        '-O',
        'exit',
        config.userAtHost
      ]);
    } catch {
      // Control socket may already be closed.
    }

    await removeFileIfExists(config.controlPath);
  }
}

async function spawnSshMaster(
  command: string,
  prefixArgs: string[],
  sshArgs: string[],
  env: NodeJS.ProcessEnv
): Promise<void> {
  const args = command === 'ssh' ? sshArgs : [...prefixArgs, 'ssh', ...sshArgs];

  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWindowsPlatform() && command !== 'ssh'
    });

    let stderr = '';
    child.stderr.on('data', chunk => {
      stderr += String(chunk);
    });

    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `Failed to start SSH control master (exit ${code ?? 'unknown'})`));
    });
  });
}

async function createAskPassScript(
  secret: string,
  env: NodeJS.ProcessEnv,
  cleanupTasks: Array<() => void | Promise<void>>
): Promise<string> {
  if (isWindowsPlatform()) {
    const envVar = `REMOTEFORGE_ASKPASS_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    env[envVar] = secret;
    cleanupTasks.push(() => {
      delete env[envVar];
    });

    const wrapperPath = path.join(os.tmpdir(), `remoteforge-askpass-${crypto.randomUUID()}.cmd`);
    await fs.promises.writeFile(
      wrapperPath,
      `@echo off\r\n"${process.execPath}" -e "process.stdout.write(process.env.${envVar}||'')"\r\n`
    );
    cleanupTasks.push(async () => removeFileIfExists(wrapperPath));
    return wrapperPath;
  }

  const scriptPath = path.join(os.tmpdir(), `remoteforge-askpass-${crypto.randomUUID()}.sh`);
  await fs.promises.writeFile(
    scriptPath,
    `#!/bin/sh\necho '${secret.replace(/'/g, `'\\''`)}'\n`,
    { mode: 0o700 }
  );
  cleanupTasks.push(async () => removeFileIfExists(scriptPath));
  return scriptPath;
}

async function removeFileIfExists(filePath: string): Promise<void> {
  if (fs.existsSync(filePath)) {
    await fs.promises.unlink(filePath);
  }
}
