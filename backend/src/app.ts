// Stub so the tests can load and fail on behaviour. Implemented in the next commit.
import express from 'express';
import type { Express } from 'express';

export function createApp(): Express {
  return express();
}
