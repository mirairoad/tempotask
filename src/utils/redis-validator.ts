import { RedisConnection } from '../types/redis.ts';

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