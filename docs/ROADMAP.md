# RemoteForge Roadmap

## Product Goal

RemoteForge is a VS Code and Cursor extension that lets developers delegate common workspace tasks to one or more VPS targets through an extension-managed SSH connection pool.

## Milestone 0: Project Foundation

- Scaffold a strict TypeScript VS Code extension targeting VS Code `^1.85.0`.
- Add Jest unit testing for pure core modules.
- Add package scripts for compile, lint, unit tests, package, and audit.
- Establish security-first core primitives: profile validation, SSH command parsing, and log redaction.

## Milestone 1: Profile Configuration MVP

- Store non-secret VPS profile metadata outside source files.
- Store passwords, private keys, and passphrases through a SecretStore abstraction.
- Add validation for names, ports, auth methods, scripts, colors, and tags.
- Parse raw SSH commands into structured connection metadata without spawning `ssh`.
- Register initial extension commands and a placeholder configuration entrypoint.

## Milestone 2: SSH Connection Pool

- Implement `SshPool` with one persistent `ssh2.Client` per profile.
- Add connection status state machine and bounded reconnect backoff.
- Add keepalive, timeout, host-key fingerprint capture, and mismatch blocking.
- Unit test pool reuse, reconnect, auth fallback, and cleanup.

## Milestone 3: VS Code UX Surface

- Add activity-bar container, TreeView, status bar, and command palette wiring.
- Add the configuration webview with CSP nonce and postMessage contract.
- Add profile CRUD and script editing in the webview.
- Add integration tests for config panel, tree refresh, and command registration.

## Milestone 4: Delegated Terminal and Scripts

- Implement SSH-backed `Pseudoterminal` through `CustomExecution`.
- Add multiple terminal tracking per profile.
- Implement quick-run scripts with terminal and silent modes.
- Test exec exit handling, stderr summaries, working directory selection, and terminal disposal.

## Milestone 5: File Sync and Tunnels

- Implement SFTP push and pull with progress events and overwrite confirmation.
- Add large-file confirmation and symlink loop guards.
- Implement local `127.0.0.1` port tunnels with kill/list lifecycle.
- Test tunnel binding, close behavior, SFTP traversal, and binary transfer paths.

## Milestone 6: Release Readiness

- Add README, CHANGELOG, icon, sidebar icon, `.vscodeignore`, and packaging docs.
- Reach at least 80% line coverage for `src/core` and `src/adapters`.
- Run integration tests against VS Code 1.85 and current stable.
- Package `.vsix` and smoke test in VS Code and Cursor.

