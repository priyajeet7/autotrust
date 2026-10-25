import type { RequestHandler, Response } from 'express';
import type { PrismaClient, Role } from '../../generated/prisma/client.js';
import { HttpError } from '../../http/errors.js';
import { verifyToken } from './tokens.js';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

const unauthenticated = () =>
  new HttpError(401, 'UNAUTHENTICATED', 'A valid bearer token is required');

/**
 * Verifies the bearer token and loads the user. The role is read from the database rather than
 * trusted from the token, so demoting or deleting a user takes effect immediately.
 */
export function requireAuth(prisma: PrismaClient, jwtSecret: string): RequestHandler {
  return async (req, res, next) => {
    const [scheme, token] = (req.get('authorization') ?? '').split(' ');
    const claims = scheme === 'Bearer' && token ? verifyToken(token, jwtSecret) : null;
    if (!claims) throw unauthenticated();

    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!user) throw unauthenticated();

    res.locals['user'] = user;
    next();
  };
}

export const requireAdmin: RequestHandler = (_req, res, next) => {
  if (getAuthUser(res).role !== 'ADMIN') {
    throw new HttpError(403, 'FORBIDDEN', 'Administrator access is required');
  }
  next();
};

/** The user attached by requireAuth. Only call from handlers mounted behind it. */
export function getAuthUser(res: Response): AuthUser {
  const user = res.locals['user'] as AuthUser | undefined;
  if (!user) throw unauthenticated();
  return user;
}
