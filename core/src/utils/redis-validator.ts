import { RedisConnection } from '../types/redis.ts';

/**
 * Checks if the given object is a RedisConnection
 * @param db - The object to check
 * @returns True if the object is a RedisConnection, false otherwise
 */
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
