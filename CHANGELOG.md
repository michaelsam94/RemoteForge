# Changelog

## 0.0.20

- Fix migration appearing stuck at 0% by reporting progress during scanning and credential loading.
- Skip rsync for password profiles without sshpass on macOS/Linux to avoid SSH password hangs.
- Try rsync before scanning all workspace files and add an rsync idle timeout fallback.

## 0.0.19

- Fix ESLint errors that caused the GitHub Actions VSIX build to fail.

## 0.0.18

- Skip rsync on Windows when it or OpenSSH is not installed, with a clear fallback message.
- Use Windows-compatible SSH askpass helpers, path formatting, and null-device paths when rsync is available.
- Skip tar on Windows when unavailable and fall back directly to parallel SFTP upload.

## 0.0.17

- Use rsync as the primary workspace migration path for faster incremental sync and better progress reporting.
- Fall back to tar archive upload and parallel SFTP when rsync is unavailable or fails.

## 0.0.16

- Fix migration stalls by uploading a single archive with SFTP fastPut instead of streaming into SSH exec stdin.
- Use fast gzip compression, 512 KB chunks, and 64-way SFTP concurrency for archive upload.

## 0.0.15

- Speed up workspace migration by streaming a compressed tar archive over SSH instead of uploading files one-by-one.
- Skip Cursor, agent, cache, and build artifact directories during migration.
- Fall back to parallel SFTP uploads when archive streaming is unavailable.

## 0.0.14

- Show percentage progress during workspace migration and VPS sync operations in the notification UI.

## 0.0.13

- Add VPS Delegate Mode section to the configuration panel for migrating the current workspace to a VPS.
- Open an SSH-backed integrated terminal on the VPS and set it as the default terminal profile while delegate mode is on.
- Auto-sync saved and newly created files to the remote workspace during delegate mode.
- Route RemoteForge command execution through the remote workspace when delegate mode is enabled.

## 0.0.12

- Add VPS workspace mode to clone the local repo to a VPS and work remotely.
- Sync workspace files to the VPS over SFTP with gitignore-aware excludes.
- Auto-upload saved files when VPS mode is enabled.
- Add status bar indicator and sync commands for VPS workspace mode.
- Allow deleting saved VPS profiles and their stored credentials from the configuration panel.

## 0.0.11

- Show saved VPS profiles in the configuration panel with connection details and quick-run scripts.
- Add per-profile Test Connection and Run actions for saved profiles using stored credentials.
- Refresh the saved profile list when opening configuration or after saving a new profile.

## 0.0.10

- Added SSH-backed connection testing that verifies authentication, not just TCP reachability.
- Added remote command delegation through `ssh2` for saved profiles and config-panel quick scripts.
- Added `RemoteForge: Run Command on VPS` command palette entry with output channel results.

## 0.0.9

- Added password and private-key credential fields to the configuration panel.
- Included password, private key path, pasted key content, and passphrase values in saved profile payloads.

## 0.0.8

- Wired the configuration panel Save Profile button to persist profile metadata and secrets.
- Wired the Test Connection button to check TCP reachability for the configured host and port.

## 0.0.7

- Made `RemoteForge: Open Configuration` open a real configuration webview instead of only showing a toast.

## 0.0.6

- Added usage instructions and keyboard shortcuts to the README.
- Added default keybindings for opening RemoteForge configuration and refreshing RemoteForge.

## 0.0.5

- Renamed the Marketplace display name to `RemoteForge VPS Delegator` because `RemoteForge` is already taken in the Marketplace.

## 0.0.4

- Renamed the Marketplace package from `remoteforge` to `remoteforge-vps` because `remoteforge` already exists in the Marketplace.

## 0.0.3

- Added a Marketplace icon and README icon preview.

## 0.0.2

- Fixed the VS Marketplace publisher ID to match `MichaelSam94`.

## 0.0.1

- Added initial TypeScript extension scaffold.
- Added foundation roadmap and Superpowers implementation plan.
- Added unit-tested core primitives for SSH command parsing, profile metadata storage, and log redaction.
