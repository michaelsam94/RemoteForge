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

export interface CollectWorkspaceFilesProgress {
  scannedFiles: number;
  currentPath: string;
}

export function collectWorkspaceFiles(
  workspaceRoot: string,
  options: CollectWorkspaceFilesOptions
): WorkspaceFileEntry[] {
  const files: WorkspaceFileEntry[] = [];
  walkDirectorySync(workspaceRoot, workspaceRoot, options.excludePatterns, files);
  return sortWorkspaceFiles(files);
}

export async function collectWorkspaceFilesAsync(
  workspaceRoot: string,
  options: CollectWorkspaceFilesOptions & { onProgress?: (progress: CollectWorkspaceFilesProgress) => void }
): Promise<WorkspaceFileEntry[]> {
  const files: WorkspaceFileEntry[] = [];
  await walkDirectoryAsync(workspaceRoot, workspaceRoot, options.excludePatterns, files, options.onProgress);
  return sortWorkspaceFiles(files);
}

export function sumWorkspaceFileBytes(files: WorkspaceFileEntry[]): number {
  return files.reduce((total, file) => total + file.size, 0);
}

function sortWorkspaceFiles(files: WorkspaceFileEntry[]): WorkspaceFileEntry[] {
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function walkDirectorySync(
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

      walkDirectorySync(workspaceRoot, absolutePath, excludePatterns, files);
      continue;
    }

    if (entry.isFile() && !shouldExclude(relativePath, excludePatterns)) {
      files.push({
        relativePath,
        absolutePath,
        size: fs.statSync(absolutePath).size
      });
    }
  }
}

async function walkDirectoryAsync(
  workspaceRoot: string,
  currentDirectory: string,
  excludePatterns: string[],
  files: WorkspaceFileEntry[],
  onProgress?: (progress: CollectWorkspaceFilesProgress) => void
): Promise<void> {
  let entriesSinceYield = 0;

  for (const entry of fs.readdirSync(currentDirectory, { withFileTypes: true })) {
    const absolutePath = path.join(currentDirectory, entry.name);
    const relativePath = path.relative(workspaceRoot, absolutePath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (isExcludedDirectory(relativePath, excludePatterns)) {
        continue;
      }

      await walkDirectoryAsync(workspaceRoot, absolutePath, excludePatterns, files, onProgress);
      continue;
    }

    if (entry.isFile() && !shouldExclude(relativePath, excludePatterns)) {
      files.push({
        relativePath,
        absolutePath,
        size: fs.statSync(absolutePath).size
      });
    }

    entriesSinceYield += 1;
    if (entriesSinceYield >= 250) {
      entriesSinceYield = 0;
      onProgress?.({ scannedFiles: files.length, currentPath: relativePath });
      await yieldToEventLoop();
    }
  }
}

function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

export function loadGitignorePatterns(workspaceRoot: string): string[] {
  const gitignorePath = path.join(workspaceRoot, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    return [];
  }

  return parseGitignoreContents(fs.readFileSync(gitignorePath, 'utf8'));
}
