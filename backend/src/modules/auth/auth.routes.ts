import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '../../generated/prisma/client.js';
import type { PrismaClient } from '../../generated/prisma/client.js';
import { HttpError, parseOrThrow } from '../../http/errors.js';
import { getAuthUser, requireAuth } from './auth.middleware.js';
import type { AuthUser } from './auth.middleware.js';
import { hashPassword, verifyPassword } from './password.js';
import { signToken } from './tokens.js';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'must be a valid email' }));

// `role` is deliberately absent: every self-registered account is a USER.
const registerSchema = z.object({
  name: z.string().trim().min(1, { error: 'is required' }).max(100),
  email,
  password: z
    .string({ error: 'is required' })
    .min(8, { error: 'must be at least 8 characters' })
    .max(128, { error: 'must be at most 128 characters' }),
});

const loginSchema = z.object({
  email,
  password: z.string({ error: 'is required' }).min(1, { error: 'is required' }),
});

const publicUser = { id: true, name: true, email: true, role: true } as const;

const invalidCredentials = () =>
  new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');

// Verified against when the email is unknown, so both failure paths cost the same time.
let dummyHash: Promise<string> | undefined;

export function authRouter(prisma: PrismaClient, jwtSecret: string): Router {
  const router = Router();
  const session = (user: AuthUser) => ({
    token: signToken({ sub: user.id, role: user.role }, jwtSecret),
    user,
  });

  router.post('/register', async (req, res) => {
    const input = parseOrThrow(registerSchema, req.body);

    try {
      const user = await prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          passwordHash: await hashPassword(input.password),
        },
        select: publicUser,
      });
      res.status(201).json({ data: session(user) });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new HttpError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
      }
      throw error;
    }
  });

  router.post('/login', async (req, res) => {
    const input = parseOrThrow(loginSchema, req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email } });

    if (!user) {
      dummyHash ??= hashPassword('timing-equaliser');
      await verifyPassword(input.password, await dummyHash);
      throw invalidCredentials();
    }
    if (!(await verifyPassword(input.password, user.passwordHash))) throw invalidCredentials();

    res.json({
      data: session({ id: user.id, name: user.name, email: user.email, role: user.role }),
    });
  });

  router.get('/me', requireAuth(prisma, jwtSecret), (_req, res) => {
    res.json({ data: { user: getAuthUser(res) } });
  });

  return router;
}
