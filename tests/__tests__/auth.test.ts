import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import app from '../../src/server';

const prisma = new PrismaClient();

describe('Authentication Tests', () => {
  let testUser: any;
  const testUserData = {
    email: 'testuser@example.com',
    password: 'TestPassword123!@#',
    firstName: 'Test',
    lastName: 'User',
  };

  beforeAll(async () => {
    // Clean up test user if exists
    await prisma.user.deleteMany({
      where: { email: testUserData.email },
    });
  });

  afterAll(async () => {
    // Clean up
    await prisma.user.deleteMany({
      where: { email: testUserData.email },
    });
    await prisma.$disconnect();
  });

  describe('POST /auth/register', () => {
    it('should register a new user with valid credentials', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send(testUserData)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user.email).toBe(testUserData.email);
      expect(response.body.user.firstName).toBe(testUserData.firstName);
      expect(response.body.user.lastName).toBe(testUserData.lastName);
      expect(response.body.user).not.toHaveProperty('passwordHash');

      // Verify refresh token cookie is set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((cookie: string) => cookie.includes('refreshToken'))).toBe(true);

      testUser = response.body.user;
    });

    it('should reject registration with duplicate email', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send(testUserData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('email');
    });

    it('should reject registration with weak password', async () => {
      const weakPasswords = [
        'short',
        'nouppercase123!',
        'NOLOWERCASE123!',
        'NoSpecialChar123',
        'NoNumber!@#',
        'onlyletters',
      ];

      for (const weakPassword of weakPasswords) {
        const response = await request(app)
          .post('/auth/register')
          .send({
            ...testUserData,
            email: `weak${Math.random()}@example.com`,
            password: weakPassword,
          })
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });

    it('should reject registration with invalid email format', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          ...testUserData,
          email: 'invalid-email',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject registration with missing required fields', async () => {
      const requiredFields = ['email', 'password', 'firstName', 'lastName'];

      for (const field of requiredFields) {
        const incompleteData = { ...testUserData };
        delete incompleteData[field as keyof typeof testUserData];

        const response = await request(app)
          .post('/auth/register')
          .send(incompleteData)
          .expect(400);

        expect(response.body).toHaveProperty('error');
      }
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUserData.email,
          password: testUserData.password,
        })
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body.user.email).toBe(testUserData.email);

      // Verify refresh token cookie is set
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((cookie: string) => cookie.includes('refreshToken'))).toBe(true);
    });

    it('should reject login with incorrect password', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUserData.email,
          password: 'WrongPassword123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUserData.password,
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject login for inactive user', async () => {
      // Create inactive user
      const inactiveUser = await prisma.user.create({
        data: {
          email: 'inactive@example.com',
          passwordHash: await bcrypt.hash('TestPassword123!', 12),
          firstName: 'Inactive',
          lastName: 'User',
          role: 'CLIENT',
          isActive: false,
        },
      });

      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'inactive@example.com',
          password: 'TestPassword123!',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');

      // Clean up
      await prisma.user.delete({ where: { id: inactiveUser.id } });
    });
  });

  describe('POST /auth/refresh', () => {
    let refreshTokenCookie: string;

    beforeEach(async () => {
      // Login to get refresh token
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUserData.email,
          password: testUserData.password,
        });

      const cookies = response.headers['set-cookie'];
      refreshTokenCookie = cookies.find((cookie: string) =>
        cookie.includes('refreshToken')
      );
    });

    it('should refresh access token with valid refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .set('Cookie', refreshTokenCookie)
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(typeof response.body.accessToken).toBe('string');
    });

    it('should reject refresh without refresh token cookie', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject refresh with invalid refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .set('Cookie', 'refreshToken=invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /auth/logout', () => {
    let refreshTokenCookie: string;

    beforeEach(async () => {
      // Login to get refresh token
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUserData.email,
          password: testUserData.password,
        });

      const cookies = response.headers['set-cookie'];
      refreshTokenCookie = cookies.find((cookie: string) =>
        cookie.includes('refreshToken')
      );
    });

    it('should logout and clear refresh token', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .set('Cookie', refreshTokenCookie)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify refresh token cookie is cleared
      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshCookie = cookies.find((cookie: string) =>
        cookie.includes('refreshToken')
      );
      expect(refreshCookie).toContain('Max-Age=0');
    });

    it('should handle logout without refresh token gracefully', async () => {
      const response = await request(app)
        .post('/auth/logout')
        .expect(200);

      expect(response.body).toHaveProperty('message');
    });
  });

  describe('Token Expiry and Security', () => {
    it('should generate different tokens for each login', async () => {
      const response1 = await request(app)
        .post('/auth/login')
        .send({
          email: testUserData.email,
          password: testUserData.password,
        });

      const response2 = await request(app)
        .post('/auth/login')
        .send({
          email: testUserData.email,
          password: testUserData.password,
        });

      expect(response1.body.accessToken).not.toBe(response2.body.accessToken);
    });

    it('should hash passwords securely (not store plain text)', async () => {
      const user = await prisma.user.findUnique({
        where: { email: testUserData.email },
      });

      expect(user?.passwordHash).toBeDefined();
      expect(user?.passwordHash).not.toBe(testUserData.password);
      expect(user?.passwordHash.length).toBeGreaterThan(50); // bcrypt hashes are long
    });

    it('should not expose sensitive data in user response', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: testUserData.email,
          password: testUserData.password,
        });

      expect(response.body.user).not.toHaveProperty('passwordHash');
      expect(response.body.user).not.toHaveProperty('password');
    });
  });
});
