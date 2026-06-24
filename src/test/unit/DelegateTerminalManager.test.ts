import { defaultProfileSettingKey } from '../../core/workspace/terminalProfileKeys';

describe('DelegateTerminalManager', () => {
  it('maps platform to terminal default profile setting key', () => {
    expect(['defaultProfile.osx', 'defaultProfile.linux', 'defaultProfile.windows']).toContain(
      defaultProfileSettingKey()
    );
  });
});
