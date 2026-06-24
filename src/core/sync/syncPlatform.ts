import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export function isWindowsPlatform(): boolean {
  return process.platform === 'win32';
}

export function nullDevicePath(): string {
  return isWindowsPlatform() ? 'NUL' : '/dev/null';
}

export async function isCommandAvailable(command: string): Promise<boolean> {
  const checker = isWindowsPlatform() ? 'where' : 'which';

  try {
    await execFileAsync(checker, [command]);
    return true;
  } catch {
    return false;
  }
}

export function formatRsyncLocalPath(
  workspaceRoot: string,
  resolvePath: (input: string) => string,
  platform: NodeJS.Platform = process.platform
): string {
  const resolved = resolvePath(workspaceRoot);
  if (platform === 'win32') {
    return `${resolved.replace(/\\/g, '/')}/`;
  }

  return `${resolved}/`;
}
