import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prismaService = app.get(PrismaService);
  });

  afterAll(async () => {
    // Clean up database
    await prismaService.user.deleteMany();
    await app.close();
  });

  beforeEach(async () => {
    // Clean up before each test
    await prismaService.user.deleteMany();
  });

  describe('/auth/register (POST)', () => {
    it('should register a new customer', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Password123!',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.email).toBe('test@example.com');
          expect(res.body.role).toBe('CUSTOMER');
          expect(res.body).not.toHaveProperty('password');
        });
    });

    it('should register a new admin', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'admin@example.com',
          password: 'AdminPass123!',
          role: 'ADMIN',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.role).toBe('ADMIN');
        });
    });

    it('should reject duplicate email', async () => {
      // First registration
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'Password123!',
        })
        .expect(201);

      // Duplicate registration
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'Password123!',
        })
        .expect(409);
    });

    it('should reject invalid email', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'invalid-email',
          password: 'Password123!',
        })
        .expect(400);
    });

    it('should reject weak password', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: '123',
        })
        .expect(400);
    });
  });

  describe('/auth/login (POST)', () => {
    beforeEach(async () => {
      // Create a test user
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email: 'user@example.com',
        password: 'Password123!',
      });
    });

    it('should login with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'user@example.com',
          password: 'Password123!',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          expect(res.body).toHaveProperty('expiresIn');
        });
    });

    it('should reject invalid password', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'user@example.com',
          password: 'WrongPassword',
        })
        .expect(401);
    });

    it('should reject non-existent user', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        })
        .expect(401);
    });
  });

  describe('/auth/refresh (POST)', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Register and login to get tokens
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email: 'refresh@example.com',
        password: 'Password123!',
      });

      const loginResponse = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
        email: 'refresh@example.com',
        password: 'Password123!',
      });

      refreshToken = loginResponse.body.refreshToken;
    });

    it('should refresh access token with valid refresh token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('accessToken');
          expect(res.body).toHaveProperty('refreshToken');
          expect(res.body).toHaveProperty('expiresIn');
        });
    });

    it('should reject invalid refresh token', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: 'invalid-token',
        })
        .expect(401);
    });

    it('should reject missing refresh token', () => {
      return request(app.getHttpServer()).post('/api/v1/auth/refresh').send({}).expect(400);
    });
  });

  describe('Protected routes', () => {
    let accessToken: string;
    let adminToken: string;

    beforeEach(async () => {
      // Create regular user
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email: 'user@example.com',
        password: 'Password123!',
      });

      const userLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
        email: 'user@example.com',
        password: 'Password123!',
      });

      accessToken = userLogin.body.accessToken;

      // Create admin user
      await request(app.getHttpServer()).post('/api/v1/auth/register').send({
        email: 'admin@example.com',
        password: 'Password123!',
        role: 'ADMIN',
      });

      const adminLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
        email: 'admin@example.com',
        password: 'Password123!',
      });

      adminToken = adminLogin.body.accessToken;
    });

    it('should access protected route with valid token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('email');
          expect(res.body).toHaveProperty('role');
        });
    });

    it('should reject request without token', () => {
      return request(app.getHttpServer()).get('/api/v1/auth/profile').expect(401);
    });

    it('should reject request with invalid token', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should allow admin access to admin-only routes', () => {
      return request(app.getHttpServer())
        .get('/api/v1/vouchers')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should deny non-admin access to admin-only routes', () => {
      return request(app.getHttpServer())
        .get('/api/v1/vouchers')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(403);
    });
  });
});
