import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import app from '../../src/server';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

describe('User Profile Management Tests', () => {
  let testUser: any;
  let accessToken: string;
  const testUserData = {
    email: 'profiletest@example.com',
    password: 'TestPassword123!@#',
    firstName: 'Profile',
    lastName: 'Test',
  };

  beforeAll(async () => {
    // Clean up test user if exists
    await prisma.user.deleteMany({
      where: { email: testUserData.email },
    });

    // Create test user
    const response = await request(app)
      .post('/auth/register')
      .send(testUserData);

    testUser = response.body.user;
    accessToken = response.body.accessToken;
  });

  afterAll(async () => {
    // Clean up
    await prisma.user.deleteMany({
      where: { email: testUserData.email },
    });
    await prisma.$disconnect();
  });

  describe('GET /users/profile', () => {
    it('should get current user profile with valid token', async () => {
      const response = await request(app)
        .get('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(testUserData.email);
      expect(response.body.firstName).toBe(testUserData.firstName);
      expect(response.body.lastName).toBe(testUserData.lastName);
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('should reject request without authentication token', async () => {
      const response = await request(app)
        .get('/users/profile')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /users/profile', () => {
    it('should update user first name', async () => {
      const response = await request(app)
        .put('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          firstName: 'UpdatedFirst',
        })
        .expect(200);

      expect(response.body.firstName).toBe('UpdatedFirst');
      expect(response.body.lastName).toBe(testUserData.lastName);
    });

    it('should update user last name', async () => {
      const response = await request(app)
        .put('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          lastName: 'UpdatedLast',
        })
        .expect(200);

      expect(response.body.lastName).toBe('UpdatedLast');
    });

    it('should update phone number', async () => {
      const phoneNumber = '+44 7700 900000';
      const response = await request(app)
        .put('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          phoneNumber,
        })
        .expect(200);

      expect(response.body.phoneNumber).toBe(phoneNumber);
    });

    it('should update multiple fields at once', async () => {
      const updates = {
        firstName: 'MultiUpdate',
        lastName: 'Test',
        phoneNumber: '+44 7700 900001',
      };

      const response = await request(app)
        .put('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.firstName).toBe(updates.firstName);
      expect(response.body.lastName).toBe(updates.lastName);
      expect(response.body.phoneNumber).toBe(updates.phoneNumber);
    });

    it('should reject email update (email should be immutable)', async () => {
      const response = await request(app)
        .put('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          email: 'newemail@example.com',
        });

      // Should either reject or ignore email update
      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(updatedUser?.email).toBe(testUserData.email);
    });

    it('should reject role update (security)', async () => {
      const response = await request(app)
        .put('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          role: 'ADMIN',
        });

      const updatedUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      expect(updatedUser?.role).not.toBe('ADMIN');
    });

    it('should reject update without authentication', async () => {
      const response = await request(app)
        .put('/users/profile')
        .send({
          firstName: 'Unauthorized',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Profile Picture/Avatar Upload', () => {
    it('should update avatar URL', async () => {
      const avatarUrl = 'https://example.com/avatar.jpg';
      const response = await request(app)
        .put('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          avatar: avatarUrl,
        })
        .expect(200);

      expect(response.body.avatar).toBe(avatarUrl);
    });

    it('should allow removing avatar (set to null)', async () => {
      // First set an avatar
      await request(app)
        .put('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          avatar: 'https://example.com/avatar.jpg',
        });

      // Then remove it
      const response = await request(app)
        .put('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          avatar: null,
        })
        .expect(200);

      expect(response.body.avatar).toBeNull();
    });

    // Note: If you implement file upload, add tests like:
    // it('should upload profile picture file', async () => {
    //   const testImagePath = path.join(__dirname, '../fixtures/test-avatar.jpg');
    //
    //   const response = await request(app)
    //     .post('/users/profile/avatar')
    //     .set('Authorization', `Bearer ${accessToken}`)
    //     .attach('avatar', testImagePath)
    //     .expect(200);
    //
    //   expect(response.body).toHaveProperty('avatar');
    //   expect(response.body.avatar).toContain('http');
    // });
  });

  describe('Password Update', () => {
    it('should update password with correct current password', async () => {
      const newPassword = 'NewPassword123!@#';

      const response = await request(app)
        .put('/users/profile/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: testUserData.password,
          newPassword,
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify can login with new password
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: testUserData.email,
          password: newPassword,
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('accessToken');

      // Update token for subsequent tests
      accessToken = loginResponse.body.accessToken;

      // Change back to original password
      await request(app)
        .put('/users/profile/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: newPassword,
          newPassword: testUserData.password,
        });
    });

    it('should reject password update with incorrect current password', async () => {
      const response = await request(app)
        .put('/users/profile/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewPassword123!@#',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject password update with weak new password', async () => {
      const response = await request(app)
        .put('/users/profile/password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: testUserData.password,
          newPassword: 'weak',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /users/:id', () => {
    it('should get user by ID (admin or self only)', async () => {
      const response = await request(app)
        .get(`/users/${testUser.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(testUser.id);
      expect(response.body.email).toBe(testUserData.email);
      expect(response.body).not.toHaveProperty('passwordHash');
    });

    it('should reject request for non-existent user ID', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/users/${fakeId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app)
        .get(`/users/${testUser.id}`)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('User Data Privacy', () => {
    it('should not expose password hash in any endpoint', async () => {
      const profileResponse = await request(app)
        .get('/users/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(profileResponse.body).not.toHaveProperty('passwordHash');

      const userResponse = await request(app)
        .get(`/users/${testUser.id}`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(userResponse.body).not.toHaveProperty('passwordHash');
    });

    it('should not allow user to view other users profiles (unless admin)', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: 'other@example.com',
          passwordHash: await bcrypt.hash('TestPassword123!', 12),
          firstName: 'Other',
          lastName: 'User',
          role: 'CLIENT',
        },
      });

      const response = await request(app)
        .get(`/users/${otherUser.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403); // Forbidden if not admin

      // Clean up
      await prisma.user.delete({ where: { id: otherUser.id } });
    });
  });

  describe('Account Deactivation', () => {
    it('should allow user to deactivate their account', async () => {
      // Create a user to deactivate
      const deactivateUser = await prisma.user.create({
        data: {
          email: 'deactivate@example.com',
          passwordHash: await bcrypt.hash('TestPassword123!', 12),
          firstName: 'Deactivate',
          lastName: 'User',
          role: 'CLIENT',
        },
      });

      // Login as that user
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'deactivate@example.com',
          password: 'TestPassword123!',
        });

      const deactivateToken = loginResponse.body.accessToken;

      // Deactivate account
      const response = await request(app)
        .put('/users/profile/deactivate')
        .set('Authorization', `Bearer ${deactivateToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');

      // Verify user cannot login
      const loginAttempt = await request(app)
        .post('/auth/login')
        .send({
          email: 'deactivate@example.com',
          password: 'TestPassword123!',
        })
        .expect(401);

      // Clean up
      await prisma.user.delete({ where: { id: deactivateUser.id } });
    });
  });
});
