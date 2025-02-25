import { delay } from './delay.ts';

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