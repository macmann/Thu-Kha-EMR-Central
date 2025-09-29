import request from 'supertest';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

import { app } from '../src/index';

const prisma = new PrismaClient();

describe('POST /api/auth/login', () => {
  const email = 'loginuser@example.com';
  const password = 'SecurePass123!';

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { email, passwordHash, role: 'Doctor', status: 'active' },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  it('rejects empty credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: '', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Email and password are required');
  });

  it('rejects invalid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password');
  });

  it('issues an access token for valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password });
    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    const segments = res.body.accessToken.split('.');
    expect(segments).toHaveLength(3);
    expect(segments[0].length).toBeGreaterThan(0);
    expect(segments[1].length).toBeGreaterThan(0);
  });
});

describe('POST /api/auth/password/change', () => {
  const email = 'changepassword@example.com';
  const password = 'OriginalPass123!';
  const newPassword = 'UpdatedPass456!';

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { email, passwordHash, role: 'Doctor', status: 'active' },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  it('requires the current password to match', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({ email, password });
    expect(loginRes.status).toBe(200);

    const token = loginRes.body.accessToken as string;
    const res = await request(app)
      .post('/api/auth/password/change')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'WrongPass!', newPassword });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Current password is incorrect');
  });

  it('allows changing the password with the correct current password', async () => {
    const loginRes = await request(app).post('/api/auth/login').send({ email, password });
    expect(loginRes.status).toBe(200);
    const token = loginRes.body.accessToken as string;

    const res = await request(app)
      .post('/api/auth/password/change')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: password, newPassword });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Password updated');

    const relogin = await request(app).post('/api/auth/login').send({ email, password: newPassword });
    expect(relogin.status).toBe(200);
  });
});

describe('Password reset flow', () => {
  const email = 'resetuser@example.com';
  const password = 'ResetPass123!';
  const newPassword = 'ResetPass789!';

  beforeAll(async () => {
    await prisma.passwordResetToken.deleteMany({ where: { user: { email } } });
    await prisma.user.deleteMany({ where: { email } });
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.create({
      data: { email, passwordHash, role: 'Doctor', status: 'active' },
    });
  });

  afterAll(async () => {
    await prisma.passwordResetToken.deleteMany({ where: { user: { email } } });
    await prisma.user.deleteMany({ where: { email } });
  });

  it('issues a reset token and updates the password', async () => {
    const forgotRes = await request(app)
      .post('/api/auth/password/forgot')
      .send({ email });

    expect(forgotRes.status).toBe(200);
    expect(forgotRes.body.message).toBe('If an account exists for that email, a reset link has been sent.');
    expect(typeof forgotRes.body.resetToken).toBe('string');

    const token = forgotRes.body.resetToken as string;

    const tooShort = await request(app)
      .post('/api/auth/password/reset')
      .send({ token, password: 'short' });
    expect(tooShort.status).toBe(400);

    const resetRes = await request(app)
      .post('/api/auth/password/reset')
      .send({ token, password: newPassword });

    expect(resetRes.status).toBe(200);
    expect(resetRes.body.message).toBe('Password updated');

    const loginRes = await request(app).post('/api/auth/login').send({ email, password: newPassword });
    expect(loginRes.status).toBe(200);

    const reuseRes = await request(app)
      .post('/api/auth/password/reset')
      .send({ token, password: `${newPassword}!` });
    expect(reuseRes.status).toBe(400);
    expect(reuseRes.body.error).toBe('Invalid or expired reset token');
  });

  it('does not leak whether the email exists', async () => {
    const res = await request(app)
      .post('/api/auth/password/forgot')
      .send({ email: 'unknown@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.resetToken).toBeUndefined();
    expect(res.body.message).toBe('If an account exists for that email, a reset link has been sent.');
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});
