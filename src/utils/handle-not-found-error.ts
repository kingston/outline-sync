/**
 * Handles an error and checks if it's an ENOENT (file not found) error.
 * If it is, returns undefined. Otherwise, rethrows the error.
 *
 * @param error - The error to handle.
 * @returns undefined if the error is ENOENT, otherwise throws the error.
 */
export function handleFileNotFoundError(error: unknown): undefined {
  if (
    error instanceof Error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  ) {
    return undefined;
  }
  throw error;
}
