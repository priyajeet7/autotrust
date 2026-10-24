import { z } from 'zod';

/**
 * Validated application configuration.
 *
 * `parseEnv` is pure (it takes the variables as an argument) so it can be unit tested without
 * touching `process.env`. Loading `.env` files is the entrypoint's job (see `server.ts`).
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'], {
      error: 'must be one of: development, test, production',
    })
    .default('development'),
  PORT: z.coerce
    .number({ error: 'must be a number' })
    .int({ error: 'must be a whole number' })
    .min(1, { error: 'must be between 1 and 65535' })
    .max(65535, { error: 'must be between 1 and 65535' })
    .default(4000),
  DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: (issue) =>
      issue.input === undefined ? 'is required' : 'must be a postgres:// or postgresql:// URL',
  }),
});

export type Env = z.infer<typeof envSchema>;

export interface EnvIssue {
  variable: string;
  message: string;
}

/** Thrown when configuration is invalid. Lists every problem; never includes the rejected values. */
export class EnvValidationError extends Error {
  constructor(public readonly issues: EnvIssue[]) {
    super(
      `Invalid environment configuration:\n${issues
        .map((issue) => `  - ${issue.variable} ${issue.message}`)
        .join('\n')}`,
    );
    this.name = 'EnvValidationError';
  }
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (result.success) return result.data;

  const issues = result.error.issues.map((issue) => ({
    variable: String(issue.path[0]),
    message: issue.message,
  }));
  throw new EnvValidationError(issues);
}
