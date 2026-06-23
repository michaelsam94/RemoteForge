# RemoteForge

RemoteForge delegates local developer workflows to VPS targets from VS Code and Cursor.

## Current Status

This repository currently contains the foundation milestone:

- Strict TypeScript VS Code extension scaffold.
- Pure core modules for profile metadata, SSH command parsing, and secret-safe logging.
- Jest unit tests for the first core contracts.
- Roadmap and Superpowers implementation plan.

The SSH connection pool, webview configuration UI, explorer view, terminals, file sync, scripts, and tunnels are planned in `docs/ROADMAP.md`.

## Development

```bash
npm install
npm run lint
npm test -- --runInBand
npm run compile
```

## Security Direction

RemoteForge is designed so profile secrets are stored through VS Code SecretStorage, never in workspace files or extension logs. The current core tests verify metadata/secret separation and log redaction.

## License

MIT
