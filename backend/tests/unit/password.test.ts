import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/modules/auth/password.js';

describe('password hashing', () => {
  it('never stores the plain password and records the algorithm and parameters', async () => {
    const hash = await hashPassword('correct-horse-battery');

    expect(hash).not.toContain('correct-horse-battery');
    expect(hash).toMatch(/^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  });

  it('salts every hash, so the same password hashes differently each time', async () => {
    const first = await hashPassword('correct-horse-battery');
    const second = await hashPassword('correct-horse-battery');

    expect(first).not.toBe(second);
  });

  it('verifies the correct password', async () => {
    const hash = await hashPassword('correct-horse-battery');

    await expect(verifyPassword('correct-horse-battery', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct-horse-battery');

    await expect(verifyPassword('Correct-horse-battery', hash)).resolves.toBe(false);
  });

  it.each(['', 'not-a-hash', 'bcrypt$10$abc', 'scrypt$16384$8$1$only-salt'])(
    'returns false instead of throwing for a malformed stored hash: %j',
    async (stored) => {
      await expect(verifyPassword('anything', stored)).resolves.toBe(false);
    },
  );
});
