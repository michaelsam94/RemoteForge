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

  it('supports -l username syntax and defaults to port 22', () => {
    expect(parseSshCommand('ssh -l deploy 203.0.113.10')).toEqual({
      host: '203.0.113.10',
      port: 22,
      username: 'deploy'
    });
  });

  it('rejects commands that do not start with ssh', () => {
    expect(() => parseSshCommand('scp deploy@203.0.113.10:/tmp/file .')).toThrow('SSH command must start with ssh');
  });
});
