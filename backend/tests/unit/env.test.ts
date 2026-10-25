import { describe, expect, it } from 'vitest';
import { EnvValidationError, parseEnv } from '../../src/config/env.js';

const validSource = {
  NODE_ENV: 'production',
  PORT: '8080',
  DATABASE_URL: 'postgresql://user:secret@db.example.com:5432/autotrust',
  JWT_SECRET: 'a-production-secret-that-is-at-least-32-chars',
};

describe('parseEnv', () => {
  it('returns typed values, coercing PORT to a number', () => {
    expect(parseEnv(validSource)).toEqual({
      NODE_ENV: 'production',
      PORT: 8080,
      DATABASE_URL: 'postgresql://user:secret@db.example.com:5432/autotrust',
      JWT_SECRET: 'a-production-secret-that-is-at-least-32-chars',
    });
  });

  it('defaults NODE_ENV to development and PORT to 4000', () => {
    const env = parseEnv({
      DATABASE_URL: validSource.DATABASE_URL,
      JWT_SECRET: validSource.JWT_SECRET,
    });

    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
  });

  it('accepts the postgres:// scheme as well as postgresql://', () => {
    const env = parseEnv({
      DATABASE_URL: 'postgres://u:p@localhost:5432/autotrust',
      JWT_SECRET: validSource.JWT_SECRET,
    });

    expect(env.DATABASE_URL).toBe('postgres://u:p@localhost:5432/autotrust');
  });

  it('ignores unrelated variables already present in process.env', () => {
    const env = parseEnv({ ...validSource, PATH: '/usr/bin', HOME: '/root' });

    expect(env).not.toHaveProperty('PATH');
  });

  it('throws an EnvValidationError naming DATABASE_URL when it is missing', () => {
    expect(() => parseEnv({ NODE_ENV: 'development' })).toThrow(EnvValidationError);
    expect(() => parseEnv({ NODE_ENV: 'development' })).toThrow(/DATABASE_URL/);
  });

  it.each(['mysql://u:p@localhost/db', 'not a url', ''])(
    'rejects a DATABASE_URL that is not a Postgres URL: %j',
    (url) => {
      expect(() => parseEnv({ ...validSource, DATABASE_URL: url })).toThrow(/DATABASE_URL/);
    },
  );

  it.each(['abc', '0', '65536', '80.5', '-1'])('rejects an invalid PORT: %j', (port) => {
    expect(() => parseEnv({ ...validSource, PORT: port })).toThrow(/PORT/);
  });

  it('throws naming JWT_SECRET when it is missing', () => {
    const withoutSecret = { ...validSource, JWT_SECRET: undefined };

    expect(() => parseEnv(withoutSecret)).toThrow(/JWT_SECRET is required/);
  });

  it('rejects a JWT_SECRET shorter than 32 characters without echoing it', () => {
    const error = captureError(() => parseEnv({ ...validSource, JWT_SECRET: 'too-short-secret' }));

    expect(error.message).toMatch(/JWT_SECRET must be at least 32 characters/);
    expect(error.message).not.toContain('too-short-secret');
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => parseEnv({ ...validSource, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it('reports every invalid variable at once, not just the first', () => {
    const error = captureError(() => parseEnv({ NODE_ENV: 'staging', PORT: 'abc' }));

    expect(error.issues.map((issue) => issue.variable).sort()).toEqual([
      'DATABASE_URL',
      'JWT_SECRET',
      'NODE_ENV',
      'PORT',
    ]);
  });

  it('never echoes the rejected value, so secrets cannot leak into logs', () => {
    const leakyUrl = 'mysql://admin:SuperSecret123@db.internal/prod';
    const error = captureError(() => parseEnv({ ...validSource, DATABASE_URL: leakyUrl }));

    expect(error.message).not.toContain('SuperSecret123');
    expect(JSON.stringify(error.issues)).not.toContain('SuperSecret123');
  });
});

function captureError(fn: () => unknown): EnvValidationError {
  try {
    fn();
  } catch (error) {
    if (error instanceof EnvValidationError) return error;
    throw error;
  }
  throw new Error('Expected parseEnv to throw');
}
