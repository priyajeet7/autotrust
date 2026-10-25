import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { signToken, verifyToken } from '../../src/modules/auth/tokens.js';

const secret = 'unit-test-secret-that-is-long-enough-1234';
const userId = '6f1c2b8e-1d2a-4c3b-9e8f-0a1b2c3d4e5f';

describe('JWT tokens', () => {
  it('round-trips the user id and role', () => {
    const token = signToken({ sub: userId, role: 'ADMIN' }, secret);

    expect(verifyToken(token, secret)).toEqual({ sub: userId, role: 'ADMIN' });
  });

  it('expires tokens', () => {
    const token = signToken({ sub: userId, role: 'USER' }, secret);
    const payload = jwt.decode(token) as { iat: number; exp: number };

    expect(payload.exp - payload.iat).toBe(8 * 60 * 60);
  });

  it('rejects a token signed with a different secret', () => {
    const token = signToken(
      { sub: userId, role: 'USER' },
      'another-secret-that-is-also-long-enough',
    );

    expect(verifyToken(token, secret)).toBeNull();
  });

  it('rejects a tampered token', () => {
    const token = signToken({ sub: userId, role: 'USER' }, secret);
    const [header, , signature] = token.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ sub: userId, role: 'ADMIN' })).toString(
      'base64url',
    );

    expect(
      verifyToken(`${String(header)}.${forgedPayload}.${String(signature)}`, secret),
    ).toBeNull();
  });

  it('rejects an expired token', () => {
    const token = jwt.sign({ sub: userId, role: 'USER' }, secret, { expiresIn: -10 });

    expect(verifyToken(token, secret)).toBeNull();
  });

  it('rejects an unsigned ("alg": "none") token', () => {
    const token = jwt.sign({ sub: userId, role: 'ADMIN' }, null, { algorithm: 'none' });

    expect(verifyToken(token, secret)).toBeNull();
  });

  it('rejects a validly signed token whose payload has the wrong shape', () => {
    const token = jwt.sign({ sub: userId, role: 'SUPERUSER' }, secret);

    expect(verifyToken(token, secret)).toBeNull();
  });

  it.each(['', 'garbage', 'a.b.c'])('rejects malformed input %j', (token) => {
    expect(verifyToken(token, secret)).toBeNull();
  });
});
