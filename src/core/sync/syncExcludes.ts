export const DEFAULT_SYNC_EXCLUDES = [
  '.git',
  'node_modules',
  'dist',
  'out',
  'coverage',
  '.vscode-test',
  '.DS_Store',
  '.codegraph',
  'graphify-out',
  '*.vsix'
];

export function shouldExclude(relativePath: string, excludePatterns: string[]): boolean {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\.\//, '');

  return excludePatterns.some(pattern => matchesExcludePattern(normalized, pattern));
}

function matchesExcludePattern(relativePath: string, pattern: string): boolean {
  const normalizedPattern = pattern.replace(/\\/g, '/');

  if (normalizedPattern.includes('*')) {
    const segments = relativePath.split('/');
    return segments.some(segment => globMatch(segment, normalizedPattern))
      || globMatch(relativePath, normalizedPattern);
  }

  return relativePath === normalizedPattern
    || relativePath.startsWith(`${normalizedPattern}/`);
}

function globMatch(value: string, pattern: string): boolean {
  const regex = new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
  return regex.test(value);
}

export function parseGitignoreContents(contents: string): string[] {
  return contents
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('#'));
}

export function mergeExcludePatterns(...groups: string[][]): string[] {
  return [...new Set(groups.flat())];
}
