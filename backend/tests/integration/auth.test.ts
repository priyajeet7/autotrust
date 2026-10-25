import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { verifyToken } from '../../src/modules/auth/tokens.js';
import { buildTestApp } from '../helpers/app.js';
import { createUser, resetDatabase, testJwtSecret, testPrisma } from '../helpers/db.js';

const app = buildTestApp();

const validRegistration = {
  name: 'Asha Verma',
  email: 'asha@example.com',
  password: 'correct-horse-battery',
};

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

describe('POST /api/auth/register', () => {
  it('creates a USER account and returns a token and the public user fields', async () => {
    const response = await request(app).post('/api/auth/register').send(validRegistration);

    expect(response.status).toBe(201);
    expect(response.body.data.user).toEqual({
      id: expect.any(String),
      name: 'Asha Verma',
      email: 'asha@example.com',
      role: 'USER',
    });
    expect(verifyToken(response.body.data.token, testJwtSecret)).toEqual({
      sub: response.body.data.user.id,
      role: 'USER',
    });
  });

  it('stores a password hash, never the password itself, and never returns the hash', async () => {
    const response = await request(app).post('/api/auth/register').send(validRegistration);

    const stored = await testPrisma.user.findUniqueOrThrow({
      where: { email: 'asha@example.com' },
    });
    expect(stored.passwordHash).not.toContain(validRegistration.password);
    expect(stored.passwordHash).toMatch(/^scrypt\$/);
    expect(JSON.stringify(response.body)).not.toContain('scrypt');
  });

  it('normalises the email to trimmed lower case', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegistration, email: '  Asha@Example.COM ' });

    expect(response.status).toBe(201);
    expect(response.body.data.user.email).toBe('asha@example.com');
  });

  it('ignores a client-supplied role, so nobody can self-register as ADMIN', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegistration, role: 'ADMIN' });

    expect(response.status).toBe(201);
    expect(response.body.data.user.role).toBe('USER');
  });

  it('responds 409 when the email is already registered (case-insensitively)', async () => {
    await request(app).post('/api/auth/register').send(validRegistration);

    const response = await request(app)
      .post('/api/auth/register')
      .send({ ...validRegistration, email: 'ASHA@example.com' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_TAKEN');
    expect(await testPrisma.user.count()).toBe(1);
  });

  it.each([
    ['a missing name', { ...validRegistration, name: '' }, 'name'],
    ['an invalid email', { ...validRegistration, email: 'not-an-email' }, 'email'],
    ['a password under 8 characters', { ...validRegistration, password: 'short' }, 'password'],
  ])('responds 400 with field details for %s', async (_label, body, field) => {
    const response = await request(app).post('/api/auth/register').send(body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field })]),
    );
    expect(await testPrisma.user.count()).toBe(0);
  });

  it('responds 400 for a malformed JSON body', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"name": ');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_JSON');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(validRegistration);
  });

  it('returns a token and the user for correct credentials', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ASHA@example.com', password: validRegistration.password });

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({ email: 'asha@example.com', role: 'USER' });
    expect(verifyToken(response.body.data.token, testJwtSecret)).not.toBeNull();
  });

  it('responds 401 for a wrong password', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: validRegistration.email, password: 'wrong-password' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('gives an unknown email exactly the same response as a wrong password', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: validRegistration.email, password: 'wrong-password' });
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'wrong-password' });

    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.body).toEqual(wrongPassword.body);
  });

  it('responds 400 when credentials are missing', async () => {
    const response = await request(app).post('/api/auth/login').send({});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/auth/me', () => {
  it('returns the current user for a valid bearer token', async () => {
    const { user, authHeader } = await createUser({ role: 'ADMIN' });

    const response = await request(app).get('/api/auth/me').set('Authorization', authHeader);

    expect(response.status).toBe(200);
    expect(response.body.data.user).toEqual({
      id: user.id,
      name: user.name,
      email: user.email,
      role: 'ADMIN',
    });
  });

  it.each([
    ['no Authorization header', undefined],
    ['a non-Bearer scheme', 'Basic dXNlcjpwYXNz'],
    ['a garbage token', 'Bearer not.a.jwt'],
  ])('responds 401 for %s', async (_label, header) => {
    const req = request(app).get('/api/auth/me');
    const response = await (header ? req.set('Authorization', header) : req);

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('responds 401 when the token belongs to a user that no longer exists', async () => {
    const { user, authHeader } = await createUser();
    await testPrisma.user.delete({ where: { id: user.id } });

    const response = await request(app).get('/api/auth/me').set('Authorization', authHeader);

    expect(response.status).toBe(401);
  });

  it('uses the role stored in the database, not the one in the token', async () => {
    const { user, authHeader } = await createUser({ role: 'ADMIN' });
    await testPrisma.user.update({ where: { id: user.id }, data: { role: 'USER' } });

    const response = await request(app).get('/api/auth/me').set('Authorization', authHeader);

    expect(response.body.data.user.role).toBe('USER');
  });
});

describe('unknown API routes', () => {
  it('respond 404 with the standard error envelope', async () => {
    const response = await request(app).get('/api/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: expect.any(String) },
    });
  });
});
