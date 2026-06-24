import * as fs from 'fs';
import * as path from 'path';
import { isExcludedDirectory, parseGitignoreContents, shouldExclude } from './syncExcludes';

export interface WorkspaceFileEntry {
  relativePath: string;
  absolutePath: string;
  size: number;
}

export interface CollectWorkspaceFilesOptions {
  excludePatterns: string[];
}

export function collectWorkspaceFiles(
  workspaceRoot: string,
  options: CollectWorkspaceFilesOptions
): WorkspaceFileEntry[] {
  const files: WorkspaceFileEntry[] = [];
  walkDirectory(workspaceRoot, workspaceRoot, options.excludePatterns, files);
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export function sumWorkspaceFileBytes(files: WorkspaceFileEntry[]): number {
  return files.reduce((total, file) => total + file.size, 0);
}

function walkDirectory(
  workspaceRoot: string,
  currentDirectory: string,
  excludePatterns: string[],
  files: WorkspaceFileEntry[]
): void {
  for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
    const absolutePath = path.join(currentDirectory, entry.name);
    const relativePath = path.relative(workspaceRoot, absolutePath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (isExcludedDirectory(relativePath, excludePatterns)) {
        continue;
      }

      walkDirectory(workspaceRoot, absolutePath, excludePatterns, files);
      continue;
    }

    if (entry.isFile()) {
      if (shouldExclude(relativePath, excludePatterns)) {
        continue;
      }

      files.push({
        relativePath,
        absolutePath,
        size: fs.statSync(absolutePath).size
      });
    }
  }
}

export function loadGitignorePatterns(workspaceRoot: string): string[] {
  const gitignorePath = path.join(workspaceRoot, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    return [];
  }

  return parseGitignoreContents(fs.readFileSync(gitignorePath, 'utf8'));
}
