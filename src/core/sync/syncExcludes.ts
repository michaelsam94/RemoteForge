export const DEFAULT_SYNC_EXCLUDES = [
  '.git',
  'node_modules',
  'dist',
  'out',
  'build',
  'coverage',
  '.vscode-test',
  '.DS_Store',
  '.codegraph',
  'graphify-out',
  '.cursor',
  'agent-transcripts',
  '.agent',
  '.agents',
  '.turbo',
  '.next',
  '.nuxt',
  '.output',
  '.cache',
  '.pnpm-store',
  '.yarn',
  '.yarn-cache',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  '.venv',
  'venv',
  '.tox',
  'target',
  '.idea',
  '.vs',
  '.gradle',
  'vendor/bundle',
  '.terraform',
  '*.vsix',
  '*.log',
  '.agentignore',
  '.cursorignore'
];

export function shouldExclude(relativePath: string, excludePatterns: string[]): boolean {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\.\//, '');

  return excludePatterns.some(pattern => matchesExcludePattern(normalized, pattern));
}

export function isExcludedDirectory(directoryName: string, excludePatterns: string[]): boolean {
  return shouldExclude(directoryName, excludePatterns)
    || shouldExclude(`${directoryName}/`, excludePatterns);
}

function matchesExcludePattern(relativePath: string, pattern: string): boolean {
  const normalizedPattern = normalizeGitignorePattern(pattern);
  if (!normalizedPattern) {
    return false;
  }

  if (normalizedPattern.includes('*')) {
    const segments = relativePath.split('/');
    return segments.some(segment => globMatch(segment, normalizedPattern))
      || globMatch(relativePath, normalizedPattern);
  }

  if (relativePath === normalizedPattern) {
    return true;
  }

  return relativePath.startsWith(`${normalizedPattern}/`)
    || relativePath.split('/').includes(normalizedPattern);
}

function globMatch(value: string, pattern: string): boolean {
  const regex = new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
  return regex.test(value);
}

export function normalizeGitignorePattern(line: string): string | undefined {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('!')) {
    return undefined;
  }

  let pattern = trimmed;
  if (pattern.startsWith('/')) {
    pattern = pattern.slice(1);
  }

  if (pattern.endsWith('/')) {
    pattern = pattern.slice(0, -1);
  }

  return pattern.length > 0 ? pattern : undefined;
}

export function parseGitignoreContents(contents: string): string[] {
  return contents
    .split(/\r?\n/)
    .map(normalizeGitignorePattern)
    .filter((pattern): pattern is string => Boolean(pattern));
}

export function mergeExcludePatterns(...groups: string[][]): string[] {
  return [...new Set(groups.flat())];
}

export function buildTarExcludeArgs(excludePatterns: string[]): string[] {
  const args: string[] = [];
  for (const pattern of excludePatterns) {
    args.push('--exclude', pattern);
  }
  return args;
}
