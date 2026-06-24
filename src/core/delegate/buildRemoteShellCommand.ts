export interface DelegateHookConfig {
  controlPath: string;
  userAtHost: string;
  port: number;
  remoteRoot: string;
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function buildRemoteShellCommand(config: DelegateHookConfig, command: string): string {
  const remotePayload = `cd ${config.remoteRoot} && ${command}`;
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
