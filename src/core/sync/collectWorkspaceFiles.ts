import * as fs from 'fs';
import * as path from 'path';
import { parseGitignoreContents, shouldExclude } from './syncExcludes';

export interface WorkspaceFileEntry {
  relativePath: string;
  absolutePath: string;
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

function walkDirectory(
  workspaceRoot: string,
  currentDirectory: string,
  excludePatterns: string[],
  files: WorkspaceFileEntry[]
): void {
  for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
    const absolutePath = path.join(currentDirectory, entry.name);
    const relativePath = path.relative(workspaceRoot, absolutePath).replace(/\\/g, '/');

    if (shouldExclude(relativePath, excludePatterns)) {
      continue;
    }

    if (entry.isDirectory()) {
      walkDirectory(workspaceRoot, absolutePath, excludePatterns, files);
      continue;
    }

    if (entry.isFile()) {
      files.push({ relativePath, absolutePath });
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
