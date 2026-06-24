import { compareWorkspaceManifests } from '../../core/sync/workspaceSyncAssessment';

describe('compareWorkspaceManifests', () => {
  it('skips sync when all local files exist remotely with matching sizes', () => {
    const local = [
      { relativePath: 'src/index.ts', size: 120 },
      { relativePath: 'package.json', size: 900 }
    ];
    const remote = [
      { relativePath: 'src/index.ts', size: 120 },
      { relativePath: 'package.json', size: 900 },
      { relativePath: 'README.md', size: 50 }
    ];

    const assessment = compareWorkspaceManifests(local, remote);
    expect(assessment.needsSync).toBe(false);
    expect(assessment.message).toContain('already on VPS');
  });

  it('requires sync when files are missing on the VPS', () => {
    const assessment = compareWorkspaceManifests(
      [{ relativePath: 'src/index.ts', size: 120 }],
      []
    );

    expect(assessment.needsSync).toBe(true);
    expect(assessment.missingOnRemote).toBe(1);
  });

  it('requires sync when file sizes differ', () => {
    const assessment = compareWorkspaceManifests(
      [{ relativePath: 'src/index.ts', size: 120 }],
      [{ relativePath: 'src/index.ts', size: 999 }]
    );

    expect(assessment.needsSync).toBe(true);
    expect(assessment.sizeMismatch).toBe(1);
  });
});
