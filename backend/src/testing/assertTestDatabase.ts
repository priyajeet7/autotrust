/**
 * Safety guard for anything that resets or seeds a database during tests.
 *
 * Call it before truncating tables. It throws unless BOTH:
 *  - NODE_ENV is exactly "test", and
 *  - the database name in DATABASE_URL ends with "_test".
 *
 * Only the database name (the URL path) is checked, so "_test" in a username or host cannot
 * satisfy it. Errors name the database but never include credentials.
 */
export class TestDatabaseGuardError extends Error {
  override name = 'TestDatabaseGuardError';
}

const TEST_DATABASE_SUFFIX = '_test';

/** @returns the verified test database name */
export function assertTestDatabase(source: Record<string, string | undefined>): string {
  if (source['NODE_ENV'] !== 'test') {
    throw new TestDatabaseGuardError(
      'Refusing to touch the database: NODE_ENV must be "test" when running test helpers.',
    );
  }

  const databaseName = readDatabaseName(source['DATABASE_URL']);

  if (!databaseName.endsWith(TEST_DATABASE_SUFFIX) || databaseName === TEST_DATABASE_SUFFIX) {
    throw new TestDatabaseGuardError(
      `Refusing to touch database "${databaseName}": test databases must be named "*${TEST_DATABASE_SUFFIX}".`,
    );
  }

  return databaseName;
}

function readDatabaseName(databaseUrl: string | undefined): string {
  if (!databaseUrl || !URL.canParse(databaseUrl)) {
    throw new TestDatabaseGuardError(
      'Refusing to touch the database: DATABASE_URL is missing or not a valid URL.',
    );
  }

  const name = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
  if (!name) {
    throw new TestDatabaseGuardError(
      'Refusing to touch the database: DATABASE_URL does not name a database.',
    );
  }
  return name;
}
