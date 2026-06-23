import { EventEmitter } from 'events';
import { testSshAuth, execRemoteCommand } from '../../core/ssh/SshExecutor';

class FakeStream extends EventEmitter {
  stderr = new EventEmitter();
}

class FakeClient extends EventEmitter {
  exec(_command: string, callback: (error: Error | undefined, stream: FakeStream) => void): void {
    const stream = new FakeStream();
    callback(undefined, stream);
    queueMicrotask(() => {
      stream.emit('data', Buffer.from('hello\n'));
      stream.emit('close', 0);
    });
  }

  connect(_config: unknown): void {
    queueMicrotask(() => this.emit('ready'));
  }

  end(): void {
    this.removeAllListeners();
  }
}

describe('SshExecutor', () => {
  it('reports successful SSH authentication', async () => {
    await expect(testSshAuth(
      { host: '203.0.113.10', port: 22, username: 'deploy', password: 'secret' },
      { createClient: () => new FakeClient() as never, connectTimeoutMs: 50 }
    )).resolves.toEqual({
      ok: true,
      message: 'SSH authentication succeeded for deploy@203.0.113.10:22'
    });
  });

  it('executes a remote command and captures stdout', async () => {
    await expect(execRemoteCommand(
      { host: '203.0.113.10', port: 22, username: 'deploy', password: 'secret' },
      'echo hello',
      undefined,
      { createClient: () => new FakeClient() as never, connectTimeoutMs: 50 }
    )).resolves.toEqual({
      exitCode: 0,
      stdout: 'hello\n',
      stderr: ''
    });
  });
});
