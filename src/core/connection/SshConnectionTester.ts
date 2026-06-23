import { testTcpConnection } from './ConnectionTester';
import { credentialsFromDraft } from '../ssh/SshCredentials';
import { testSshAuth } from '../ssh/SshExecutor';
import { VpsProfileDraft } from '../profile/ProfileTypes';

export interface ProfileConnectionTestResult {
  ok: boolean;
  message: string;
}

export async function testProfileConnection(profile: VpsProfileDraft): Promise<ProfileConnectionTestResult> {
  const tcpResult = await testTcpConnection({ host: profile.host, port: profile.port });
  if (!tcpResult.ok) {
    return tcpResult;
  }

  if (profile.authMethod === 'sshCommand') {
    return {
      ok: true,
      message: `${tcpResult.message}. SSH command auth is configured; use delegated execution to verify credentials.`
    };
  }

  const credentials = credentialsFromDraft(profile);
  if (!hasAuthMaterial(profile, credentials)) {
    return {
      ok: true,
      message: `${tcpResult.message}. Add credentials to verify SSH authentication.`
    };
  }

  const sshResult = await testSshAuth(credentials);
  return sshResult;
}

function hasAuthMaterial(
  profile: VpsProfileDraft,
  credentials: ReturnType<typeof credentialsFromDraft>
): boolean {
  if (profile.authMethod === 'password') {
    return Boolean(credentials.password);
  }

  if (profile.authMethod === 'privateKey') {
    return Boolean(credentials.privateKey);
  }

  return false;
}
