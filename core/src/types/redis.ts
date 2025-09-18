import type { Redis, RedisOptions } from 'ioredis';

/**
 * Extended Redis options with additional properties
 */
export interface ExtendedRedisOptions extends RedisOptions {
  optimise?: boolean;
}

/**
 * Represents a Redis connection with extended options
 */
export interface RedisConnection extends Redis {
  options: ExtendedRedisOptions;
}
