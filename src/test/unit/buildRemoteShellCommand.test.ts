import { buildRemoteShellCommand } from '../../core/delegate/buildRemoteShellCommand';

describe('buildRemoteShellCommand', () => {
  it('wraps agent commands in an ssh control-master invocation', () => {
    expect(buildRemoteShellCommand({
      controlPath: '/tmp/remoteforge/control',
      userAtHost: 'root@203.0.113.10',
      port: 22,
      remoteRoot: '/srv/apps/RemoteForge'
    }, 'npm test')).toBe(
      "ssh -S '/tmp/remoteforge/control' -p 22 -o StrictHostKeyChecking=accept-new -o BatchMode=yes root@203.0.113.10 'cd /srv/apps/RemoteForge && npm test'"
    );
  });
});
