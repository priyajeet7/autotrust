import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { z } from 'zod';

export interface ErrorDetail {
  field: string;
  message: string;
}

/** An error that maps directly onto an HTTP response: `{ error: { code, message, details? } }`. */
export class HttpError extends Error {
  override name = 'HttpError';

  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: ErrorDetail[],
  ) {
    super(message);
  }
}

/** Parses `input` with `schema`, turning validation failures into a 400 with per-field details. */
export function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  throw new HttpError(
    400,
    'VALIDATION_ERROR',
    'Request validation failed',
    result.error.issues.map((issue) => ({
      field: issue.path.join('.') || '(root)',
      message: issue.message,
    })),
  );
}

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, 'NOT_FOUND', 'Route not found'));
};

/** Final error handler. Unknown errors become a generic 500 so internals never leak to clients. */
export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
    return;
  }

  if (isBodyParserError(error)) {
    res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Malformed JSON body' } });
    return;
  }

  console.error(error);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
};

function isBodyParserError(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    'type' in error &&
    (error as { type: unknown }).type === 'entity.parse.failed'
  );
}
