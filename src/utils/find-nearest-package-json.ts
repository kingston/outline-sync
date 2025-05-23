import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Options for the findNearestPackageJson function
 */
interface FindNearestPackageJsonOptions {
  /**
   * Starting directory
   */
  cwd?: string;
  /**
   * Stop search if node_modules is found
   */
  stopAtNodeModules?: boolean;
}

/**
 * Find the nearest package.json file
 *
 * @param options - Options for the search
 * @returns The path to the nearest package.json file, or undefined if not found
 */
export async function findNearestPackageJson(
  options: FindNearestPackageJsonOptions = {},
): Promise<string | undefined> {
  const { cwd = process.cwd(), stopAtNodeModules = false } = options;
  const { root } = path.parse(cwd);
  let currentDir = path.resolve(cwd);

  for (;;) {
    try {
      // Check for package.json
      const packageJsonPath = path.join(currentDir, 'package.json');
      const stat = await fs.stat(packageJsonPath);
      if (stat.isFile()) {
        return packageJsonPath;
      }
    } catch {
      // Ignore errors and continue searching
    }

    if (currentDir === root) {
      return undefined;
    }

    if (stopAtNodeModules && path.basename(currentDir) === 'node_modules') {
      return undefined;
    }

    currentDir = path.dirname(currentDir); // Move up one directory
  }
}
