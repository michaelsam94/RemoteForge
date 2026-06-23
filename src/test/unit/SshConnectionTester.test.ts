import { testProfileConnection } from '../../core/connection/SshConnectionTester';
import { testSshAuth } from '../../core/ssh/SshExecutor';
import { testTcpConnection } from '../../core/connection/ConnectionTester';

jest.mock('../../core/connection/ConnectionTester', () => ({
  testTcpConnection: jest.fn()
}));

jest.mock('../../core/ssh/SshExecutor', () => ({
  testSshAuth: jest.fn()
}));

describe('testProfileConnection', () => {
  const mockedTcp = jest.mocked(testTcpConnection);
  const mockedSsh = jest.mocked(testSshAuth);

  beforeEach(() => {
    mockedTcp.mockReset();
    mockedSsh.mockReset();
  });

  it('returns TCP failure without attempting SSH auth', async () => {
    mockedTcp.mockResolvedValue({ ok: false, message: 'Could not reach host' });

    await expect(testProfileConnection({
      name: 'Prod',
      host: '203.0.113.10',
      port: 22,
      username: 'root',
      authMethod: 'password',
      password: 'secret'
    })).resolves.toEqual({ ok: false, message: 'Could not reach host' });

    expect(mockedSsh).not.toHaveBeenCalled();
  });

  it('verifies SSH auth when password credentials are present', async () => {
    mockedTcp.mockResolvedValue({ ok: true, message: 'Reached 203.0.113.10:22' });
    mockedSsh.mockResolvedValue({ ok: true, message: 'SSH ok' });

    await expect(testProfileConnection({
      name: 'Prod',
      host: '203.0.113.10',
      port: 22,
      username: 'root',
      authMethod: 'password',
      password: 'secret'
    })).resolves.toEqual({ ok: true, message: 'SSH ok' });
  });
});
