// Stub so the tests can load and fail on behaviour. Implemented in the next commit.
export class TestDatabaseGuardError extends Error {
  override name = 'TestDatabaseGuardError';
}

export function assertTestDatabase(_source: Record<string, string | undefined>): string {
  return '';
}
