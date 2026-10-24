import { describe, expect, it } from 'vitest';
import {
  TestDatabaseGuardError,
  assertTestDatabase,
} from '../../src/testing/assertTestDatabase.js';

const testUrl = 'postgresql://autotrust:pw@localhost:5432/autotrust_test';

describe('assertTestDatabase', () => {
  it('allows a database whose name ends in _test when NODE_ENV is test, returning the name', () => {
    expect(assertTestDatabase({ NODE_ENV: 'test', DATABASE_URL: testUrl })).toBe('autotrust_test');
  });

  it('ignores query parameters when reading the database name', () => {
    const url = `${testUrl}?schema=public&connection_limit=5`;

    expect(assertTestDatabase({ NODE_ENV: 'test', DATABASE_URL: url })).toBe('autotrust_test');
  });

  it.each([undefined, 'development', 'production'])(
    'refuses when NODE_ENV is %j, even for a _test database',
    (nodeEnv) => {
      expect(() => assertTestDatabase({ NODE_ENV: nodeEnv, DATABASE_URL: testUrl })).toThrow(
        TestDatabaseGuardError,
      );
    },
  );

  it.each([
    ['the development database', 'postgresql://autotrust:pw@localhost:5432/autotrust'],
    ['a name that only contains "test"', 'postgresql://u:pw@localhost:5432/autotrust_testing'],
    ['a name with a suffix after _test', 'postgresql://u:pw@localhost:5432/autotrust_test_backup'],
    ['an upper-case suffix', 'postgresql://u:pw@localhost:5432/autotrust_TEST'],
    ['a bare "test" name', 'postgresql://u:pw@localhost:5432/test'],
    ['_test only in the username', 'postgresql://autotrust_test:pw@localhost:5432/autotrust'],
    ['_test only in the host', 'postgresql://u:pw@db_test.local:5432/autotrust'],
    ['no database name at all', 'postgresql://u:pw@localhost:5432/'],
  ])('refuses %s', (_label, url) => {
    expect(() => assertTestDatabase({ NODE_ENV: 'test', DATABASE_URL: url })).toThrow(
      TestDatabaseGuardError,
    );
  });

  it.each([undefined, '', 'not a url'])(
    'refuses a missing or unparseable DATABASE_URL: %j',
    (url) => {
      expect(() => assertTestDatabase({ NODE_ENV: 'test', DATABASE_URL: url })).toThrow(
        TestDatabaseGuardError,
      );
    },
  );

  it('names the offending database in the error but never the password', () => {
    const url = 'postgresql://admin:SuperSecret123@prod-db:5432/autotrust';

    expect(() => assertTestDatabase({ NODE_ENV: 'test', DATABASE_URL: url })).toThrow(
      /"autotrust"/,
    );
    expect(() => assertTestDatabase({ NODE_ENV: 'test', DATABASE_URL: url })).not.toThrow(
      /SuperSecret123/,
    );
  });
});
