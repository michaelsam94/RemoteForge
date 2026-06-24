# Graph Report - RemoteForge  (2026-06-24)

## Corpus Check
- 46 files · ~15,316 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 395 nodes · 825 edges · 15 communities
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7ef7996e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]

## God Nodes (most connected - your core abstractions)
1. `VpsWorkspaceService` - 23 edges
2. `ProfileManager` - 22 edges
3. `VpsProfile` - 19 edges
4. `Changelog` - 19 edges
5. `SshConnectConfig` - 14 edges
6. `compilerOptions` - 12 edges
7. `handleConfigMessage()` - 12 edges
8. `VpsWorkspaceState` - 11 edges
9. `withSshClient()` - 11 edges
10. `isWindowsPlatform()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `sendProfiles()` --calls--> `resolveRemoteWorkspacePath()`  [EXTRACTED]
  src/ui/webview/ConfigPanel.ts → src/core/sync/WorkspaceSync.ts
- `handleConfigMessage()` --calls--> `testProfileConnection()`  [EXTRACTED]
  src/ui/webview/ConfigPanel.ts → src/core/connection/SshConnectionTester.ts
- `testProfileConnection()` --calls--> `testSshAuth()`  [EXTRACTED]
  src/core/connection/SshConnectionTester.ts → src/core/ssh/SshExecutor.ts
- `ResolvedProfileCredentials` --references--> `VpsProfile`  [EXTRACTED]
  src/core/ssh/SshCredentials.ts → src/core/profile/ProfileTypes.ts
- `ensureRemoteDirectory()` --calls--> `withSshClient()`  [EXTRACTED]
  src/core/sync/rsyncSync.ts → src/core/ssh/SshExecutor.ts

## Import Cycles
- None detected.

## Communities (15 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.07
Nodes (48): DelegateModeSummary, withSshClient(), collectWorkspaceFiles(), CollectWorkspaceFilesOptions, loadGitignorePatterns(), walkDirectory(), WorkspaceFileEntry, ensureRemoteDirectoryTree() (+40 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (24): ConfigStoreAdapter, ConnectionTestResult, messageFromError(), TcpConnectionOptions, TcpTarget, testTcpConnection(), hasAuthMaterial(), ProfileConnectionTestResult (+16 more)

### Community 2 - "Community 2"
Cohesion: 0.08
Nodes (33): SecretStoreAdapter, getOutputChannel(), runRemoteCommand(), showCommandOutput(), disableVpsMode(), enableDelegateModeWithPrompt(), enableVpsMode(), runDelegateActivation() (+25 more)

### Community 3 - "Community 3"
Cohesion: 0.14
Nodes (8): DelegateTerminalManager, toWorkspaceRelativePath(), VpsWorkspaceService, SshConnectConfig, createStatusBarProgressReporter(), SyncProgressHandler, defaultProfileSettingKey(), VpsWorkspaceState

### Community 4 - "Community 4"
Cohesion: 0.05
Nodes (41): activationEvents, categories, contributes, commands, keybindings, terminal, dependencies, ssh2 (+33 more)

### Community 5 - "Community 5"
Cohesion: 0.10
Nodes (19): 0.0.1, 0.0.10, 0.0.11, 0.0.12, 0.0.13, 0.0.14, 0.0.15, 0.0.16 (+11 more)

### Community 6 - "Community 6"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, module, outDir, rootDir, skipLibCheck (+6 more)

### Community 7 - "Community 7"
Cohesion: 0.20
Nodes (4): levels, Logger, LogLevel, LogSink

### Community 8 - "Community 8"
Cohesion: 0.14
Nodes (13): Current Status, Development, How To Install, How To Use, Key Features, License, Open RemoteForge Configuration, Project Structure (+5 more)

### Community 9 - "Community 9"
Cohesion: 0.20
Nodes (9): Milestone 0: Project Foundation, Milestone 1: Profile Configuration MVP, Milestone 2: SSH Connection Pool, Milestone 3: VS Code UX Surface, Milestone 4: Delegated Terminal and Scripts, Milestone 5: File Sync and Tunnels, Milestone 6: Release Readiness, Product Goal (+1 more)

### Community 10 - "Community 10"
Cohesion: 0.43
Nodes (6): ParsedSshCommand, parsePort(), parseSshCommand(), parseTarget(), readFlagValue(), tokenize()

### Community 11 - "Community 11"
Cohesion: 0.33
Nodes (5): RemoteForge Foundation Implementation Plan, Task 1: Test Harness and RED Tests, Task 2: Minimal Core Implementation, Task 3: VS Code Extension Skeleton, Task 4: Final Verification

### Community 12 - "Community 12"
Cohesion: 0.33
Nodes (5): compilerOptions, types, exclude, extends, include

### Community 13 - "Community 13"
Cohesion: 0.16
Nodes (25): applyAskPassEnv(), buildRsyncExcludeArgs(), buildSshCommand(), createAskPassHelper(), createAskPassScript(), ensureRemoteDirectory(), execFileAsync, getRsyncCapabilities() (+17 more)

### Community 14 - "Community 14"
Cohesion: 0.12
Nodes (12): buildConnectConfig(), connectClient(), execRemoteCommand(), messageFromError(), shellQuote(), SshConnectionResult, SshExecutorOptions, testSshAuth() (+4 more)

## Knowledge Gaps
- **112 isolated node(s):** `extends`, `types`, `include`, `exclude`, `name` (+107 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `VpsWorkspaceService` connect `Community 3` to `Community 0`, `Community 2`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Why does `VpsProfile` connect `Community 1` to `Community 0`, `Community 2`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `ProfileManager` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **What connects `extends`, `types`, `include` to the rest of the system?**
  _112 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.07168458781362007 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08208020050125313 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.07918367346938776 - nodes in this community are weakly interconnected._