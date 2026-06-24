import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { formatRsyncLocalPath, nullDevicePath } from '../../core/sync/syncPlatform';
import { DEFAULT_SYNC_EXCLUDES, buildFindExcludeClauses, buildTarExcludeArgs, parseGitignoreContents, shouldExclude } from '../../core/sync/syncExcludes';
import { buildRsyncExcludeArgs, countRsyncDryRunChanges, parseRsyncProgressPercent } from '../../core/sync/rsyncSync';
import { collectWorkspaceFiles } from '../../core/sync/collectWorkspaceFiles';
import {
  formatSyncProgressMessage,
  remoteWorkspacePath,
  syncProgressIncrement,
  syncProgressPercent
} from '../../core/sync/sftpOperations';

describe('syncExcludes', () => {
  it('excludes directories and glob patterns', () => {
    expect(shouldExclude('node_modules/react/index.js', DEFAULT_SYNC_EXCLUDES)).toBe(true);
    expect(shouldExclude('.git/config', DEFAULT_SYNC_EXCLUDES)).toBe(true);
    expect(shouldExclude('.cursor/projects/state.json', DEFAULT_SYNC_EXCLUDES)).toBe(true);
    expect(shouldExclude('.agentignore', DEFAULT_SYNC_EXCLUDES)).toBe(true);
    expect(shouldExclude('src/extension.ts', DEFAULT_SYNC_EXCLUDES)).toBe(false);
    expect(shouldExclude('release.vsix', ['*.vsix'])).toBe(true);
  });

  it('normalizes gitignore patterns', () => {
    expect(parseGitignoreContents('# comment\n\n/dist/\n')).toEqual(['dist']);
  });

  it('builds tar exclude arguments', () => {
    expect(buildTarExcludeArgs(['node_modules', '.git'])).toEqual([
      '--exclude', 'node_modules',
      '--exclude', '.git'
    ]);
  });

  it('builds find exclude clauses for remote listing', () => {
    expect(buildFindExcludeClauses(['node_modules', '.git', '*.vsix'])).toEqual([
      '!', '-path', './node_modules',
      '!', '-path', './node_modules/*',
      '!', '-path', './.git',
      '!', '-path', './.git/*',
      '!', '-name', '*.vsix'
    ]);
  });

  it('builds rsync exclude arguments', () => {
    expect(buildRsyncExcludeArgs(['node_modules', '.git'])).toEqual([
      '--exclude', 'node_modules',
      '--exclude', '.git'
    ]);
  });
});

describe('rsync progress parsing', () => {
  it('parses progress2 output', () => {
    expect(parseRsyncProgressPercent('    123456789   45%  123.45MB/s    0:00:42 (xfr#100, to-chk=0/500)')).toBe(45);
  });

  it('parses classic progress output', () => {
    expect(parseRsyncProgressPercent('        1234 100%    1.23MB/s    0:00:01 (xfr#1, to-chk=0/1)')).toBe(100);
  });

  it('counts changed files from dry-run output', () => {
    const output = [
      'sending incremental file list',
      'src/extension.ts',
      '',
      'sent 123 bytes  received 12 bytes',
      'total size is 999'
    ].join('\n');

    expect(countRsyncDryRunChanges(output)).toBe(1);
  });

  it('returns zero when dry-run finds no changes', () => {
    const output = [
      'sending incremental file list',
      '',
      'sent 123 bytes  received 12 bytes',
      'total size is 999'
    ].join('\n');

    expect(countRsyncDryRunChanges(output)).toBe(0);
  });
});

describe('sync platform helpers', () => {
  it('uses the correct null device per platform', () => {
    expect(nullDevicePath()).toBe(process.platform === 'win32' ? 'NUL' : '/dev/null');
  });

  it('formats rsync local paths with forward slashes on Windows', () => {
    expect(formatRsyncLocalPath('C:\\work\\repo', input => input, 'win32')).toBe('C:/work/repo/');
  });

  it('keeps unix paths unchanged aside from trailing slash', () => {
    expect(formatRsyncLocalPath('/work/repo', input => input, 'linux')).toBe('/work/repo/');
  });
});

describe('collectWorkspaceFiles', () => {
  it('collects files while honoring exclude patterns', () => {
    const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'remoteforge-'));
    fs.mkdirSync(path.join(workspaceRoot, 'src'));
    fs.mkdirSync(path.join(workspaceRoot, 'node_modules', 'pkg'), { recursive: true });
    fs.writeFileSync(path.join(workspaceRoot, 'src', 'index.ts'), 'export {};');
    fs.writeFileSync(path.join(workspaceRoot, 'node_modules', 'pkg', 'index.js'), 'module.exports = {};');

    const files = collectWorkspaceFiles(workspaceRoot, {
      excludePatterns: ['node_modules', 'dist']
    });

    expect(files.map(file => file.relativePath)).toEqual(['src/index.ts']);
  });
});

describe('remoteWorkspacePath', () => {
  it('uses default workdir when provided', () => {
    expect(remoteWorkspacePath({
      id: '1',
      name: 'Prod',
      host: '203.0.113.10',
      port: 22,
      username: 'deploy',
      authMethod: 'password',
      defaultWorkdir: '/srv/apps',
      scripts: [],
      createdAt: 'now',
      updatedAt: 'now'
    }, 'RemoteForge')).toBe('/srv/apps/RemoteForge');
  });
});

describe('sync progress formatting', () => {
  it('calculates percentage and message', () => {
    const progress = { current: 25, total: 100, file: 'src/extension.ts' };
    expect(syncProgressPercent(progress)).toBe(25);
    expect(syncProgressIncrement(progress)).toBe(1);
    expect(formatSyncProgressMessage(progress)).toBe('25% — src/extension.ts');
  });

  it('includes file counts for non-percent progress totals', () => {
    const progress = { current: 25, total: 200, file: 'src/extension.ts' };
    expect(formatSyncProgressMessage(progress)).toBe('13% — src/extension.ts (25/200)');
  });

  it('handles empty workspaces', () => {
    const progress = { current: 0, total: 0, file: 'No files to sync' };
    expect(syncProgressPercent(progress)).toBe(0);
    expect(formatSyncProgressMessage(progress)).toBe('0% — No files to sync');
  });
});
