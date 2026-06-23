import { testTcpConnection } from '../../core/connection/ConnectionTester';

describe('testTcpConnection', () => {
  it('reports success when the TCP connector succeeds', async () => {
    await expect(testTcpConnection(
      { host: '203.0.113.10', port: 22 },
      { connect: () => Promise.resolve(), timeoutMs: 50 }
    )).resolves.toEqual({ ok: true, message: 'Reached 203.0.113.10:22' });
  });

  it('reports failure when the TCP connector rejects', async () => {
    await expect(testTcpConnection(
      { host: '203.0.113.10', port: 22 },
      { connect: () => Promise.reject(new Error('ECONNREFUSED')), timeoutMs: 50 }
    )).resolves.toEqual({ ok: false, message: 'Could not reach 203.0.113.10:22: ECONNREFUSED' });
  });
});
