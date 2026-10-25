import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { ScryptOptions } from 'node:crypto';

/**
 * Password hashing with Node's built-in scrypt (memory-hard, no native add-on to compile).
 *
 * Stored format: `scrypt$N$r$p$<salt base64>$<hash base64>`. The parameters travel with each
 * hash, so they can be raised later without invalidating existing passwords.
 */
const COST = 16384; // N
const BLOCK_SIZE = 8; // r
const PARALLELISM = 1; // p
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

function deriveKey(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password, salt, { N: COST, r: BLOCK_SIZE, p: PARALLELISM });
  return [
    'scrypt',
    COST,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

/** Constant-time comparison. Returns false (never throws) for a malformed stored hash. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, n, r, p, salt, hash, ...rest] = stored.split('$');
  if (algorithm !== 'scrypt' || !n || !r || !p || !salt || !hash || rest.length > 0) return false;

  const expected = Buffer.from(hash, 'base64');
  if (expected.length !== KEY_LENGTH) return false;

  try {
    const actual = await deriveKey(password, Buffer.from(salt, 'base64'), {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
