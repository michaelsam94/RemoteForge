export interface ParsedSshCommand {
  host: string;
  port: number;
  username: string;
  keyPath?: string;
  jumpHost?: string;
}

export function parseSshCommand(command: string): ParsedSshCommand {
  const tokens = tokenize(command);

  if (tokens[0] !== 'ssh') {
    throw new Error('SSH command must start with ssh');
  }

  let port = 22;
  let keyPath: string | undefined;
  let jumpHost: string | undefined;
  let explicitUsername: string | undefined;
  let target: string | undefined;

  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index];

    if (token === '-i') {
      keyPath = readFlagValue(tokens, ++index, '-i');
      continue;
    }

    if (token === '-p') {
      port = parsePort(readFlagValue(tokens, ++index, '-p'));
      continue;
    }

    if (token === '-J') {
      jumpHost = readFlagValue(tokens, ++index, '-J');
      continue;
    }

    if (token === '-l') {
      explicitUsername = readFlagValue(tokens, ++index, '-l');
      continue;
    }

    if (!token.startsWith('-')) {
      target = token;
    }
  }

  if (!target) {
    throw new Error('SSH command must include user@host or -l user host');
  }

  const parsedTarget = parseTarget(target, explicitUsername);

  return {
    host: parsedTarget.host,
    port,
    username: parsedTarget.username,
    ...(keyPath ? { keyPath } : {}),
    ...(jumpHost ? { jumpHost } : {})
  };
}

function tokenize(command: string): string[] {
  return command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(token => token.replace(/^["']|["']$/g, '')) ?? [];
}

function readFlagValue(tokens: string[], index: number, flag: string): string {
  const value = tokens[index];
  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }

  return value;
}

function parsePort(rawPort: string): number {
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Port must be between 1 and 65535');
  }

  return port;
}

function parseTarget(target: string, explicitUsername: string | undefined): Pick<ParsedSshCommand, 'host' | 'username'> {
  if (target.includes('@')) {
    const match = target.match(/^(?<username>[^@\s]+)@(?<host>[^\s]+)$/);
    if (!match?.groups) {
      throw new Error('SSH command must include user@host');
    }

    return { host: match.groups.host, username: match.groups.username };
  }

  if (!explicitUsername) {
    throw new Error('SSH command must include user@host or -l user host');
  }

  return { host: target, username: explicitUsername };
}
