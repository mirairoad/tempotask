import { delay } from './delay.ts';

/**
 * Retries an operation a specified number of times with a delay between attempts
 * @param operation - The operation to retry
 * @param maxAttempts - The maximum number of attempts
 * @param delayMs - The delay in milliseconds between attempts
 * @returns The result of the operation
 */
export const retry = async <T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000,
): Promise<T> => {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await delay(delayMs);
      }
    }
  }

  throw lastError;
};
