import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { DiscountType } from '@prisma/client';

describe('PromotionsController (e2e)', () => {
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
    await prismaService.promotion.deleteMany();
    await prismaService.user.deleteMany();
    await app.close();
  });

  beforeEach(async () => {
    // Clean up promotions before each test
    await prismaService.promotion.deleteMany();
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

  describe('/api/v1/promotions (POST)', () => {
    it('should create a promotion with eligible categories', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      return request(app.getHttpServer())
        .post('/api/v1/promotions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'TECHSALE',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 15,
          expirationDate: tomorrow.toISOString(),
          usageLimit: 100,
          eligibleCategories: ['Electronics', 'Gadgets'],
          eligibleItems: [],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.code).toBe('TECHSALE');
          expect(res.body.discountType).toBe(DiscountType.PERCENTAGE);
          expect(res.body.discountValue).toBe('15.00');
          expect(res.body.usageLimit).toBe(100);
          expect(res.body.currentUsage).toBe(0);
          expect(res.body.eligibleCategories).toEqual(['Electronics', 'Gadgets']);
          expect(res.body.eligibleItems).toEqual([]);
          expect(res.body.isActive).toBe(true);
        });
    });

    it('should create a promotion with eligible items', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      return request(app.getHttpServer())
        .post('/api/v1/promotions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'ITEMSALE',
          discountType: DiscountType.FIXED,
          discountValue: 5,
          expirationDate: tomorrow.toISOString(),
          usageLimit: 50,
          eligibleCategories: [],
          eligibleItems: ['PROD-001', 'PROD-002'],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.code).toBe('ITEMSALE');
          expect(res.body.discountType).toBe(DiscountType.FIXED);
          expect(res.body.discountValue).toBe('5.00');
          expect(res.body.eligibleCategories).toEqual([]);
          expect(res.body.eligibleItems).toEqual(['PROD-001', 'PROD-002']);
        });
    });

    it('should create a promotion with both categories and items', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      return request(app.getHttpServer())
        .post('/api/v1/promotions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'MIXEDSALE',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 10,
          expirationDate: tomorrow.toISOString(),
          usageLimit: 200,
          eligibleCategories: ['Electronics'],
          eligibleItems: ['PROD-999'],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.code).toBe('MIXEDSALE');
          expect(res.body.eligibleCategories).toEqual(['Electronics']);
          expect(res.body.eligibleItems).toEqual(['PROD-999']);
        });
    });

    it('should reject promotion with no eligibility criteria', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      return request(app.getHttpServer())
        .post('/api/v1/promotions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'NOELIGIBLE',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 10,
          expirationDate: tomorrow.toISOString(),
          usageLimit: 100,
          eligibleCategories: [],
          eligibleItems: [],
        })
        .expect(400);
    });

    it('should reject duplicate promotion code', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Create first promotion
      await request(app.getHttpServer())
        .post('/api/v1/promotions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'DUPLICATE',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 20,
          expirationDate: tomorrow.toISOString(),
          usageLimit: 100,
          eligibleCategories: ['Electronics'],
          eligibleItems: [],
        })
        .expect(201);

      // Try to create duplicate
      return request(app.getHttpServer())
        .post('/api/v1/promotions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'DUPLICATE',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 30,
          expirationDate: tomorrow.toISOString(),
          usageLimit: 50,
          eligibleCategories: ['Books'],
          eligibleItems: [],
        })
        .expect(409);
    });

    it('should reject invalid percentage discount (> 100)', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      return request(app.getHttpServer())
        .post('/api/v1/promotions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'INVALID',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 150,
          expirationDate: tomorrow.toISOString(),
          usageLimit: 100,
          eligibleCategories: ['Electronics'],
          eligibleItems: [],
        })
        .expect(400);
    });

    it('should reject expired expiration date', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      return request(app.getHttpServer())
        .post('/api/v1/promotions')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'EXPIRED',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 20,
          expirationDate: yesterday.toISOString(),
          usageLimit: 100,
          eligibleCategories: ['Electronics'],
          eligibleItems: [],
        })
        .expect(400);
    });

    it('should deny non-admin access', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      return request(app.getHttpServer())
        .post('/api/v1/promotions')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          code: 'FORBIDDEN',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 20,
          expirationDate: tomorrow.toISOString(),
          usageLimit: 100,
          eligibleCategories: ['Electronics'],
          eligibleItems: [],
        })
        .expect(403);
    });
  });

  describe('/api/v1/promotions (GET)', () => {
    beforeEach(async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Create test promotions
      const promotions = [
        {
          code: 'ACTIVE1',
          discountValue: 10,
          isActive: true,
          eligibleCategories: ['Electronics'],
        },
        {
          code: 'ACTIVE2',
          discountValue: 20,
          isActive: true,
          eligibleCategories: ['Books'],
        },
        {
          code: 'INACTIVE',
          discountValue: 30,
          isActive: false,
          eligibleCategories: ['Clothing'],
        },
      ];

      for (const promotion of promotions) {
        await prismaService.promotion.create({
          data: {
            code: promotion.code,
            discountType: DiscountType.PERCENTAGE,
            discountValue: promotion.discountValue,
            expirationDate: tomorrow,
            usageLimit: 100,
            isActive: promotion.isActive,
            eligibleCategories: promotion.eligibleCategories,
            eligibleItems: [],
          },
        });
      }
    });

    it('should list all promotions with pagination', () => {
      return request(app.getHttpServer())
        .get('/api/v1/promotions')
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
        .get('/api/v1/promotions?isActive=true')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveLength(2);
          expect(res.body.data.every((p: any) => p.isActive === true)).toBe(true);
        });
    });

    it('should paginate results', () => {
      return request(app.getHttpServer())
        .get('/api/v1/promotions?page=1&limit=1')
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
        .get('/api/v1/promotions')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });
  });

  describe('/api/v1/promotions/:code (GET)', () => {
    beforeEach(async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await prismaService.promotion.create({
        data: {
          code: 'TESTCODE',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 25,
          expirationDate: tomorrow,
          usageLimit: 100,
          eligibleCategories: ['Electronics', 'Gadgets'],
          eligibleItems: ['PROD-001'],
        },
      });
    });

    it('should get promotion by code', () => {
      return request(app.getHttpServer())
        .get('/api/v1/promotions/TESTCODE')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.code).toBe('TESTCODE');
          expect(res.body.discountValue).toBe('25.00');
          expect(res.body.eligibleCategories).toEqual(['Electronics', 'Gadgets']);
          expect(res.body.eligibleItems).toEqual(['PROD-001']);
        });
    });

    it('should handle case-insensitive code', () => {
      return request(app.getHttpServer())
        .get('/api/v1/promotions/testcode')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.code).toBe('TESTCODE');
        });
    });

    it('should return 404 for non-existent code', () => {
      return request(app.getHttpServer())
        .get('/api/v1/promotions/NONEXISTENT')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('/api/v1/promotions/:code (PATCH)', () => {
    beforeEach(async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await prismaService.promotion.create({
        data: {
          code: 'UPDATEME',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 20,
          expirationDate: tomorrow,
          usageLimit: 100,
          eligibleCategories: ['Electronics'],
          eligibleItems: [],
        },
      });
    });

    it('should update promotion properties', () => {
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + 7);

      return request(app.getHttpServer())
        .patch('/api/v1/promotions/UPDATEME')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          discountValue: 30,
          usageLimit: 200,
          expirationDate: newDate.toISOString(),
          eligibleCategories: ['Electronics', 'Gadgets'],
          eligibleItems: ['PROD-001'],
          isActive: false,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.code).toBe('UPDATEME');
          expect(res.body.discountValue).toBe('30.00');
          expect(res.body.usageLimit).toBe(200);
          expect(res.body.isActive).toBe(false);
          expect(res.body.eligibleCategories).toEqual(['Electronics', 'Gadgets']);
          expect(res.body.eligibleItems).toEqual(['PROD-001']);
        });
    });

    it('should not allow code update', () => {
      return request(app.getHttpServer())
        .patch('/api/v1/promotions/UPDATEME')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'NEWCODE',
        })
        .expect(400);
    });

    it('should reject update with no eligibility criteria', () => {
      return request(app.getHttpServer())
        .patch('/api/v1/promotions/UPDATEME')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          eligibleCategories: [],
          eligibleItems: [],
        })
        .expect(400);
    });

    it('should return 404 for non-existent promotion', () => {
      return request(app.getHttpServer())
        .patch('/api/v1/promotions/NONEXISTENT')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          discountValue: 30,
        })
        .expect(404);
    });
  });

  describe('/api/v1/promotions/:code (DELETE)', () => {
    it('should soft delete promotion with no usage', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await prismaService.promotion.create({
        data: {
          code: 'DELETEME',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 20,
          expirationDate: tomorrow,
          usageLimit: 100,
          currentUsage: 0,
          eligibleCategories: ['Electronics'],
          eligibleItems: [],
        },
      });

      await request(app.getHttpServer())
        .delete('/api/v1/promotions/DELETEME')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      // Verify soft delete
      const promotion = await prismaService.promotion.findUnique({
        where: { code: 'DELETEME' },
      });
      expect(promotion.deletedAt).not.toBeNull();
    });

    it('should reject delete for promotion with usage', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await prismaService.promotion.create({
        data: {
          code: 'USED',
          discountType: DiscountType.PERCENTAGE,
          discountValue: 20,
          expirationDate: tomorrow,
          usageLimit: 100,
          currentUsage: 5,
          eligibleCategories: ['Electronics'],
          eligibleItems: [],
        },
      });

      return request(app.getHttpServer())
        .delete('/api/v1/promotions/USED')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);
    });

    it('should return 404 for non-existent promotion', () => {
      return request(app.getHttpServer())
        .delete('/api/v1/promotions/NONEXISTENT')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });
});
