export interface RedisConnection {
  xadd(
    key: string,
    id: string,
    ...args: unknown[]
  ): Promise<string>;
  xgroup(
    command: string,
    key: string,
    groupName: string,
    id: string,
    mkstream?: string
  ): Promise<'OK'>;
  xreadgroup(
    command: string,
    group: string,
    consumer: string,
    ...args: unknown[]
  ): Promise<[string, [string, string]][]>;
  xdel(key: string, id: string): Promise<number>;
  xtrim(
    key: string,
    strategy: string,
    threshold: number | string | undefined
  ): Promise<number>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<'OK'>;
  del(key: string): Promise<number>;
  scan(
    cursor: string,
    match?: string,
    pattern?: string,
    count?: string|number,
    ...args: unknown[]
  ): Promise<[string, string[]]>;
  xpending(
    key: string,
    group: string,
    start: string,
    end: string,
    count: number
  ): Promise<any>;
  xclaim(
    key: string,
    group: string,
    consumer: string,
    minIdleTime: number,
    ids: string[]
  ): Promise<any>;
  xack(
    key: string,
    group: string,
    ...ids: string[]
  ): Promise<number>;
} 