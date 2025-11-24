import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { DiscountType } from '@prisma/client';

describe('VouchersController (e2e)', () => {
  let app: INestApplication;
  let prismaService: PrismaService;
  let adminToken: string;
  let customerToken: string;

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
    await prismaService.voucher.deleteMany();
    await prismaService.user.deleteMany();
    await app.close();
  });

  beforeEach(async () => {
    // Clean up vouchers before each test
    await prismaService.voucher.deleteMany();
    await prismaService.user.deleteMany();

    // Create admin user and get token
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'admin@test.com',
      password: 'AdminPass123!',
      role: 'ADMIN',
    });

    const adminLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'admin@test.com',
      password: 'AdminPass123!',
    });

    adminToken = adminLogin.body.accessToken;

    // Create customer user and get token
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email: 'customer@test.com',
      password: 'CustomerPass123!',
    });

    const customerLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({
      email: 'customer@test.com',
      password: 'CustomerPass123!',
    });

    customerToken = customerLogin.body.accessToken;
  });

  describe('/api/v1/vouchers (POST)', () => {
    it('should create a voucher with auto-generated code', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      return request(app.getHttpServer())
        .post('/api/v1/vouchers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          discountType: DiscountType.PERCENTAGE,
          discountValue: 20,
          expirationDate: tomorrow.toISOString(),
          usageLimit: 100,
          minOrderValue: 50,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body).toHaveProperty('code');
          expect(res.body.code).toMatch(/^[A-Z0-9]{8}$/);
          expect(res.body.discountType).toBe(DiscountType.PERCENTAGE);
          expect(res.body.discountValue).toBe('20.00');
          expect(res.body.usageLimit).toBe(100);
          expect(res.body.currentUsage).toBe(0);
          expect(res.body.minOrderValue).toBe('50.00');
          expect(res.body.isActive).toBe(true);
        });
    });

    it('should create a voucher with custom code', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      return request(app.getHttpServer())
        .post('/api/v1/vouchers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'SUMMER25',
          discountType: DiscountType.FIXED,
          discountValue: 10,
          expirationDate: tomorrow.toISOString(),
          usageLimit: 50,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.code).toBe('SUMMER25');
          expect(res.body.discountType).toBe(DiscountType.FIXED);
          expect(res.body.discountValue).toBe('10.00');
          expect(res.body.minOrderValue).toBeNull();
        });
    });

    it('should reject duplicate voucher code', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Create first voucher
      await request(app.getHttpServer())
        .post('/api/v1/vouchers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'DUPLICATE',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 20,
          expirationDate: tomorrow.toISOString(),
          usageLimit: 100,
        })
        .expect(201);

      // Try to create duplicate
      return request(app.getHttpServer())
        .post('/api/v1/vouchers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'DUPLICATE',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 30,
          expirationDate: tomorrow.toISOString(),
          usageLimit: 50,
        })
        .expect(409);
    });

    it('should reject invalid percentage discount (> 100)', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      return request(app.getHttpServer())
        .post('/api/v1/vouchers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          discountType: DiscountType.PERCENTAGE,
          discountValue: 150,
          expirationDate: tomorrow.toISOString(),
          usageLimit: 100,
        })
        .expect(400);
    });

    it('should reject expired expiration date', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      return request(app.getHttpServer())
        .post('/api/v1/vouchers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          discountType: DiscountType.PERCENTAGE,
          discountValue: 20,
          expirationDate: yesterday.toISOString(),
          usageLimit: 100,
        })
        .expect(400);
    });

    it('should deny non-admin access', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      return request(app.getHttpServer())
        .post('/api/v1/vouchers')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          discountType: DiscountType.PERCENTAGE,
          discountValue: 20,
          expirationDate: tomorrow.toISOString(),
          usageLimit: 100,
        })
        .expect(403);
    });
  });

  describe('/api/v1/vouchers (GET)', () => {
    beforeEach(async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Create test vouchers
      const vouchers = [
        { code: 'ACTIVE1', discountValue: 10, isActive: true },
        { code: 'ACTIVE2', discountValue: 20, isActive: true },
        { code: 'INACTIVE', discountValue: 30, isActive: false },
      ];

      for (const voucher of vouchers) {
        await prismaService.voucher.create({
          data: {
            code: voucher.code,
            discountType: DiscountType.PERCENTAGE,
            discountValue: voucher.discountValue,
            expirationDate: tomorrow,
            usageLimit: 100,
            isActive: voucher.isActive,
          },
        });
      }
    });

    it('should list all vouchers with pagination', () => {
      return request(app.getHttpServer())
        .get('/api/v1/vouchers')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('meta');
          expect(res.body.data).toHaveLength(3);
          expect(res.body.meta.total).toBe(3);
          expect(res.body.meta.page).toBe(1);
          expect(res.body.meta.limit).toBe(20);
        });
    });

    it('should filter by active status', () => {
      return request(app.getHttpServer())
        .get('/api/v1/vouchers?isActive=true')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(2);
          expect(res.body.data.every((v: any) => v.isActive === true)).toBe(true);
        });
    });

    it('should paginate results', () => {
      return request(app.getHttpServer())
        .get('/api/v1/vouchers?page=1&limit=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(1);
          expect(res.body.meta.page).toBe(1);
          expect(res.body.meta.limit).toBe(1);
          expect(res.body.meta.totalPages).toBe(3);
        });
    });

    it('should deny non-admin access', () => {
      return request(app.getHttpServer())
        .get('/api/v1/vouchers')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });
  });

  describe('/api/v1/vouchers/:code (GET)', () => {
    beforeEach(async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await prismaService.voucher.create({
        data: {
          code: 'TESTCODE',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 25,
          expirationDate: tomorrow,
          usageLimit: 100,
          minOrderValue: 50,
        },
      });
    });

    it('should get voucher by code', () => {
      return request(app.getHttpServer())
        .get('/api/v1/vouchers/TESTCODE')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.code).toBe('TESTCODE');
          expect(res.body.discountValue).toBe('25.00');
          expect(res.body.minOrderValue).toBe('50.00');
        });
    });

    it('should handle case-insensitive code', () => {
      return request(app.getHttpServer())
        .get('/api/v1/vouchers/testcode')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.code).toBe('TESTCODE');
        });
    });

    it('should return 404 for non-existent code', () => {
      return request(app.getHttpServer())
        .get('/api/v1/vouchers/NONEXISTENT')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('/api/v1/vouchers/:code (PATCH)', () => {
    beforeEach(async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await prismaService.voucher.create({
        data: {
          code: 'UPDATEME',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 20,
          expirationDate: tomorrow,
          usageLimit: 100,
          minOrderValue: 50,
        },
      });
    });

    it('should update voucher properties', () => {
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + 7);

      return request(app.getHttpServer())
        .patch('/api/v1/vouchers/UPDATEME')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          discountValue: 30,
          usageLimit: 200,
          expirationDate: newDate.toISOString(),
          isActive: false,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.code).toBe('UPDATEME');
          expect(res.body.discountValue).toBe('30.00');
          expect(res.body.usageLimit).toBe(200);
          expect(res.body.isActive).toBe(false);
        });
    });

    it('should not allow code update', () => {
      return request(app.getHttpServer())
        .patch('/api/v1/vouchers/UPDATEME')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'NEWCODE',
        })
        .expect(400);
    });

    it('should return 404 for non-existent voucher', () => {
      return request(app.getHttpServer())
        .patch('/api/v1/vouchers/NONEXISTENT')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          discountValue: 30,
        })
        .expect(404);
    });
  });

  describe('/api/v1/vouchers/:code (DELETE)', () => {
    it('should soft delete voucher with no usage', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await prismaService.voucher.create({
        data: {
          code: 'DELETEME',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 20,
          expirationDate: tomorrow,
          usageLimit: 100,
          currentUsage: 0,
        },
      });

      await request(app.getHttpServer())
        .delete('/api/v1/vouchers/DELETEME')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      // Verify soft delete
      const voucher = await prismaService.voucher.findUnique({
        where: { code: 'DELETEME' },
      });
      expect(voucher.deletedAt).not.toBeNull();
    });

    it('should reject delete for voucher with usage', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await prismaService.voucher.create({
        data: {
          code: 'USED',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 20,
          expirationDate: tomorrow,
          usageLimit: 100,
          currentUsage: 5,
        },
      });

      return request(app.getHttpServer())
        .delete('/api/v1/vouchers/USED')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should return 404 for non-existent voucher', () => {
      return request(app.getHttpServer())
        .delete('/api/v1/vouchers/NONEXISTENT')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});
