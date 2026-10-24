// Stub so the tests can load and fail on behaviour. Implemented in the next commit.
export interface EnvIssue {
  variable: string;
  message: string;
}

export class EnvValidationError extends Error {
  constructor(public readonly issues: EnvIssue[]) {
    super('Invalid environment configuration');
    this.name = 'EnvValidationError';
  }
}

export function parseEnv(_source: Record<string, string | undefined>): never {
  throw new Error('parseEnv is not implemented yet');
}
