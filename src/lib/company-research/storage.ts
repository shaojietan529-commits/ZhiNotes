import type { KvEnv } from "../account/server";

export interface ResearchStorage {
  get<T>(key: string): Promise<T | null>;
  put(key: string, value: unknown, seconds: number): Promise<void>;
  eval<T>(script: string, keys: string[], args: string[]): Promise<T>;
}

// Isolated namespace; atomic leases prevent parallel clicks/devices from charging twice.
export class ResearchRedis implements ResearchStorage {
  constructor(private env: KvEnv) {}
  private async command<T>(command: (string | number)[]): Promise<T> {
    const response = await fetch(this.env.url, { method: "POST", headers: {
      authorization: `Bearer ${this.env.token}`, "Content-Type": "application/json",
    }, body: JSON.stringify(command), cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("research-storage-unavailable");
    const value = await response.json();
    if (value.error) throw new Error("research-storage-unavailable");
    return value.result as T;
  }
  async get<T>(key: string) { const value = await this.command<string | null>(["GET", key]); return value ? JSON.parse(value) as T : null; }
  async put(key: string, value: unknown, seconds: number) { await this.command(["SET", key, JSON.stringify(value), "EX", seconds]); }
  async eval<T>(script: string, keys: string[], args: string[]) { return this.command<T>(["EVAL", script, keys.length, ...keys, ...args]); }
}

export const CLAIM = `-- research-claim-v1
local used = redis.call('GET', KEYS[4])
if used then return {'duplicate', used} end
local active = redis.call('GET', KEYS[1])
if active then return {'busy', active} end
if redis.call('EXISTS', KEYS[6]) == 1 then return {'cooldown', ''} end
local spent = tonumber(redis.call('GET', KEYS[3]) or '0')
if spent + tonumber(ARGV[3]) > tonumber(ARGV[4]) then return {'budget', ''} end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[5])
redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[6])
redis.call('SET', KEYS[4], ARGV[1], 'EX', ARGV[6])
redis.call('SET', KEYS[5], ARGV[2], 'EX', ARGV[6])
redis.call('SET', KEYS[6], '1', 'EX', 60)
redis.call('INCRBY', KEYS[3], ARGV[3])
redis.call('EXPIRE', KEYS[3], ARGV[6])
return {'claimed', ARGV[1]}`;

export const FINISH = `-- research-finish-v1
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local job = cjson.decode(raw)
if job.status ~= 'running' then return 0 end
if redis.call('GET', KEYS[2]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[5])
if ARGV[3] ~= '' then redis.call('SET', KEYS[3], ARGV[3], 'EX', ARGV[5]) end
redis.call('INCRBY', KEYS[4], ARGV[4])
redis.call('EXPIRE', KEYS[4], ARGV[5])
if redis.call('GET', KEYS[5]) == ARGV[1] then redis.call('DEL', KEYS[5]) end
return 1`;
