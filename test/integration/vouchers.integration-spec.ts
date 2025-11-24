import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../src/prisma/prisma.service';
import { VouchersService } from '../../src/vouchers/vouchers.service';
import { ConfigService } from '@nestjs/config';
import { DiscountType } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

describe('Vouchers Integration Tests', () => {
  let service: VouchersService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VouchersService,
        PrismaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key) => {
              const config: any = {
                'database.url':
                  process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test',
                nodeEnv: 'test',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<VouchersService>(VouchersService);
    prisma = module.get<PrismaService>(PrismaService);

    await prisma.onModuleInit();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy();
  });

  beforeEach(async () => {
    // Clean database before each test
    await prisma.voucher.deleteMany();
  });

  describe('Voucher CRUD Operations', () => {
    it('should create and retrieve a voucher', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const createDto = {
        code: 'TESTINT01',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 25,
        expirationDate: tomorrow,
        usageLimit: 100,
        minOrderValue: 50,
      };

      // Create voucher
      const created = await service.create(createDto);
      expect(created.code).toBe('TESTINT01');
      expect(created.discountType).toBe(DiscountType.PERCENTAGE);
      expect(Number(created.discountValue)).toBe(25);

      // Retrieve voucher
      const retrieved = await service.findOne('TESTINT01');
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.code).toBe('TESTINT01');
    });

    it('should handle concurrent voucher creation with auto-generated codes', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const createDto = {
        discountType: DiscountType.FIXED,
        discountValue: 10,
        expirationDate: tomorrow,
        usageLimit: 50,
      };

      // Create multiple vouchers concurrently
      const promises = Array(5)
        .fill(null)
        .map(() => service.create(createDto));

      const vouchers = await Promise.all(promises);

      // All should be created successfully with unique codes
      expect(vouchers).toHaveLength(5);
      const codes = vouchers.map((v) => v.code);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(5); // All codes should be unique
    });

    it('should update voucher with optimistic locking', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Create initial voucher
      await prisma.voucher.create({
        data: {
          code: 'OPTIMISTIC',
          discountType: DiscountType.PERCENTAGE,
          discountValue: new Decimal(20),
          expirationDate: tomorrow,
          usageLimit: 100,
          version: 0,
        },
      });

      // Update voucher
      const updated = await service.update('OPTIMISTIC', {
        discountValue: 30,
        usageLimit: 200,
      });

      expect(Number(updated.discountValue)).toBe(30);
      expect(updated.usageLimit).toBe(200);
      expect(updated.version).toBe(1); // Version should increment
    });

    it('should handle soft delete correctly', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Create voucher
      await prisma.voucher.create({
        data: {
          code: 'SOFTDELETE',
          discountType: DiscountType.FIXED,
          discountValue: new Decimal(15),
          expirationDate: tomorrow,
          usageLimit: 100,
          currentUsage: 0,
        },
      });

      // Soft delete
      await service.remove('SOFTDELETE');

      // Should not appear in normal queries
      const allVouchers = await service.findAll({ page: 1, limit: 10 });
      expect(allVouchers.data).toHaveLength(0);

      // But should still exist in database with deletedAt
      const deleted = await prisma.voucher.findUnique({
        where: { code: 'SOFTDELETE' },
      });
      expect(deleted).not.toBeNull();
      expect(deleted.deletedAt).not.toBeNull();
      expect(deleted.isActive).toBe(false);
    });
  });

  describe('Voucher Validation', () => {
    it('should validate all voucher rules', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await prisma.voucher.create({
        data: {
          code: 'VALIDATE',
          discountType: DiscountType.PERCENTAGE,
          discountValue: new Decimal(20),
          expirationDate: tomorrow,
          usageLimit: 100,
          currentUsage: 50,
          minOrderValue: new Decimal(75),
          isActive: true,
        },
      });

      // Valid order value
      const valid = await service.validateVoucher('VALIDATE', 100);
      expect(valid.code).toBe('VALIDATE');

      // Order value below minimum
      await expect(service.validateVoucher('VALIDATE', 50)).rejects.toThrow(
        'Order value is below minimum required',
      );
    });

    it('should handle usage limit validation', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await prisma.voucher.create({
        data: {
          code: 'MAXUSAGE',
          discountType: DiscountType.FIXED,
          discountValue: new Decimal(10),
          expirationDate: tomorrow,
          usageLimit: 1,
          currentUsage: 1,
          isActive: true,
        },
      });

      await expect(service.validateVoucher('MAXUSAGE', 100)).rejects.toThrow(
        'Voucher usage limit has been reached',
      );
    });

    it('should handle expiration validation', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await prisma.voucher.create({
        data: {
          code: 'EXPIRED',
          discountType: DiscountType.PERCENTAGE,
          discountValue: new Decimal(15),
          expirationDate: yesterday,
          usageLimit: 100,
          currentUsage: 0,
          isActive: true,
        },
      });

      await expect(service.validateVoucher('EXPIRED', 100)).rejects.toThrow('Voucher has expired');
    });
  });

  describe('Pagination and Filtering', () => {
    beforeEach(async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Create test data
      const vouchers = [];
      for (let i = 1; i <= 25; i++) {
        vouchers.push({
          code: `PAGE${i.toString().padStart(2, '0')}`,
          discountType: DiscountType.PERCENTAGE,
          discountValue: new Decimal(i),
          expirationDate: tomorrow,
          usageLimit: 100,
          isActive: i % 2 === 0, // Even numbers are active
        });
      }

      await prisma.voucher.createMany({ data: vouchers });
    });

    it('should paginate results correctly', async () => {
      // First page
      const page1 = await service.findAll({ page: 1, limit: 10 });
      expect(page1.data).toHaveLength(10);
      expect(page1.meta.total).toBe(25);
      expect(page1.meta.totalPages).toBe(3);

      // Second page
      const page2 = await service.findAll({ page: 2, limit: 10 });
      expect(page2.data).toHaveLength(10);

      // Last page
      const page3 = await service.findAll({ page: 3, limit: 10 });
      expect(page3.data).toHaveLength(5);
    });

    it('should filter by active status', async () => {
      const active = await service.findAll({ page: 1, limit: 30, isActive: true });
      expect(active.data).toHaveLength(12); // Even numbers only

      const inactive = await service.findAll({ page: 1, limit: 30, isActive: false });
      expect(inactive.data).toHaveLength(13); // Odd numbers only
    });
  });

  describe('Concurrent Updates', () => {
    it('should handle concurrent usage updates with version control', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      await prisma.voucher.create({
        data: {
          code: 'CONCURRENT',
          discountType: DiscountType.FIXED,
          discountValue: new Decimal(10),
          expirationDate: tomorrow,
          usageLimit: 100,
          currentUsage: 0,
          version: 0,
        },
      });

      // Simulate concurrent updates
      const updateUsage = async () => {
        const current = await prisma.voucher.findUnique({
          where: { code: 'CONCURRENT' },
        });

        if (!current) throw new Error('Voucher not found');

        try {
          return await prisma.voucher.update({
            where: {
              id: current.id,
              version: current.version,
            },
            data: {
              currentUsage: { increment: 1 },
              version: { increment: 1 },
            },
          });
        } catch (error) {
          // Retry on version mismatch
          return updateUsage();
        }
      };

      // Run 5 concurrent updates
      await Promise.all(
        Array(5)
          .fill(null)
          .map(() => updateUsage()),
      );

      // Check final state
      const final = await prisma.voucher.findUnique({
        where: { code: 'CONCURRENT' },
      });

      expect(final.currentUsage).toBe(5);
      expect(final.version).toBe(5);
    });
  });
});
