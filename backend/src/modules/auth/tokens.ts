import jwt from 'jsonwebtoken';
import { z } from 'zod';

const TOKEN_LIFETIME_SECONDS = 8 * 60 * 60;

const claimsSchema = z.object({
  sub: z.string().min(1),
  role: z.enum(['USER', 'ADMIN']),
});

export type TokenClaims = z.infer<typeof claimsSchema>;

export function signToken(claims: TokenClaims, secret: string): string {
  return jwt.sign({ role: claims.role }, secret, {
    algorithm: 'HS256',
    subject: claims.sub,
    expiresIn: TOKEN_LIFETIME_SECONDS,
  });
}

/** Returns the claims of a valid, unexpired HS256 token, or null for anything else. */
export function verifyToken(token: string, secret: string): TokenClaims | null {
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    const result = claimsSchema.safeParse(payload);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
