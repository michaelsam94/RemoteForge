import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DEFAULT_SYNC_EXCLUDES, parseGitignoreContents, shouldExclude } from '../../core/sync/syncExcludes';
import { collectWorkspaceFiles } from '../../core/sync/collectWorkspaceFiles';
import { remoteWorkspacePath } from '../../core/sync/sftpOperations';

describe('syncExcludes', () => {
  it('excludes directories and glob patterns', () => {
    expect(shouldExclude('node_modules/react/index.js', DEFAULT_SYNC_EXCLUDES)).toBe(true);
    expect(shouldExclude('.git/config', DEFAULT_SYNC_EXCLUDES)).toBe(true);
    expect(shouldExclude('src/extension.ts', DEFAULT_SYNC_EXCLUDES)).toBe(false);
    expect(shouldExclude('release.vsix', ['*.vsix'])).toBe(true);
  });

  it('parses gitignore comments and blank lines', () => {
    expect(parseGitignoreContents('# comment\n\n/dist\n')).toEqual(['/dist']);
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
