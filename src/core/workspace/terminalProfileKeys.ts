export function defaultProfileSettingKey(): string {
  switch (process.platform) {
    case 'darwin':
      return 'defaultProfile.osx';
    case 'win32':
      return 'defaultProfile.windows';
    default:
      return 'defaultProfile.linux';
  }
}

export const delegateTerminalProfileId = 'remoteforge.delegate';
