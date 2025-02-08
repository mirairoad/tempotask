import crypto from 'node:crypto';
import { RedisConnection } from './types.ts';
export const genJobId = (name: string, data: unknown): string => {
  const dataString = JSON.stringify(data);
  const hash = crypto.createHash('sha256').update(dataString).digest('hex');
  return `${name}:${hash}`;
};

export const isRedisConnection = (db: unknown): db is RedisConnection => {
  return (
    typeof db === 'object' &&
    db !== null &&
    'set' in db &&
    'get' in db &&
    'del' in db &&
    'scan' in db &&
    'watch' in db &&
    'unwatch' in db &&
    'multi' in db
  );
};

export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

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
