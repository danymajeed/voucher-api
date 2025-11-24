import { Test, TestingModule } from '@nestjs/testing';
import { VouchersService } from '../../src/vouchers/vouchers.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { DiscountType } from '@prisma/client';

describe('VouchersService', () => {
  let service: VouchersService;
  let _prismaService: PrismaService;

  const mockPrismaService = {
    voucher: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VouchersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<VouchersService>(VouchersService);
    _prismaService = module.get<PrismaService>(PrismaService);

    // Clear all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const createDto = {
      discountType: DiscountType.PERCENTAGE,
      discountValue: 20,
      expirationDate: tomorrow,
      usageLimit: 100,
      minOrderValue: 50,
    };

    it('should create voucher with auto-generated code', async () => {
      const mockVoucher = {
        id: 'voucher-id',
        code: 'AUTO1234',
        ...createDto,
        currentUsage: 0,
        isActive: true,
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockPrismaService.voucher.findFirst.mockResolvedValue(null); // No duplicate
      mockPrismaService.voucher.create.mockResolvedValue(mockVoucher);

      const result = await service.create(createDto);

      expect(result).toEqual(mockVoucher);
      expect(mockPrismaService.voucher.create).toHaveBeenCalled();
      expect(mockPrismaService.voucher.create.mock.calls[0][0].data).toHaveProperty('code');
      expect(mockPrismaService.voucher.create.mock.calls[0][0].data.code).toMatch(/^[A-Z0-9]{8}$/);
    });

    it('should create voucher with custom code', async () => {
      const dtoWithCode = { ...createDto, code: 'SUMMER25' };
      const mockVoucher = {
        id: 'voucher-id',
        code: 'SUMMER25',
        ...createDto,
        currentUsage: 0,
        isActive: true,
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockPrismaService.voucher.findFirst.mockResolvedValue(null); // No duplicate
      mockPrismaService.voucher.create.mockResolvedValue(mockVoucher);

      const result = await service.create(dtoWithCode);

      expect(result.code).toBe('SUMMER25');
      expect(mockPrismaService.voucher.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          code: 'SUMMER25',
        }),
      });
    });

    it('should reject duplicate code', async () => {
      const dtoWithCode = { ...createDto, code: 'DUPLICATE' };

      mockPrismaService.voucher.findFirst.mockResolvedValue({
        id: 'existing',
        code: 'DUPLICATE',
      });

      await expect(service.create(dtoWithCode)).rejects.toThrow(ConflictException);
      expect(mockPrismaService.voucher.create).not.toHaveBeenCalled();
    });

    it('should reject percentage discount over 100', async () => {
      const invalidDto = {
        ...createDto,
        discountType: DiscountType.PERCENTAGE,
        discountValue: 150,
      };

      await expect(service.create(invalidDto)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.voucher.create).not.toHaveBeenCalled();
    });

    it('should reject past expiration date', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const invalidDto = {
        ...createDto,
        expirationDate: yesterday,
      };

      await expect(service.create(invalidDto)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.voucher.create).not.toHaveBeenCalled();
    });

    it('should handle code generation retry on collision', async () => {
      const mockVoucher = {
        id: 'voucher-id',
        code: 'UNIQUE123',
        ...createDto,
        currentUsage: 0,
        isActive: true,
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      // First generated code exists, second one doesn't
      mockPrismaService.voucher.findFirst
        .mockResolvedValueOnce({ id: 'existing', code: 'EXISTS11' })
        .mockResolvedValueOnce(null);

      mockPrismaService.voucher.create.mockResolvedValue(mockVoucher);

      const result = await service.create(createDto);

      expect(result).toEqual(mockVoucher);
      expect(mockPrismaService.voucher.findFirst).toHaveBeenCalledTimes(2);
    });
  });

  describe('findAll', () => {
    it('should return paginated vouchers', async () => {
      const mockVouchers = [
        { id: '1', code: 'CODE1', discountValue: 10 },
        { id: '2', code: 'CODE2', discountValue: 20 },
      ];

      mockPrismaService.voucher.findMany.mockResolvedValue(mockVouchers);
      mockPrismaService.voucher.count.mockResolvedValue(2);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(mockVouchers);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should filter by active status', async () => {
      mockPrismaService.voucher.findMany.mockResolvedValue([]);
      mockPrismaService.voucher.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, isActive: true });

      expect(mockPrismaService.voucher.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            deletedAt: null,
          }),
        }),
      );
    });

    it('should exclude soft-deleted vouchers', async () => {
      mockPrismaService.voucher.findMany.mockResolvedValue([]);
      mockPrismaService.voucher.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 });

      expect(mockPrismaService.voucher.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should find voucher by code (case-insensitive)', async () => {
      const mockVoucher = {
        id: 'id',
        code: 'TESTCODE',
        discountValue: 25,
      };

      mockPrismaService.voucher.findFirst.mockResolvedValue(mockVoucher);

      const result = await service.findOne('testcode');

      expect(result).toEqual(mockVoucher);
      expect(mockPrismaService.voucher.findFirst).toHaveBeenCalledWith({
        where: {
          code: 'TESTCODE',
          deletedAt: null,
        },
      });
    });

    it('should throw NotFoundException for non-existent code', async () => {
      mockPrismaService.voucher.findFirst.mockResolvedValue(null);

      await expect(service.findOne('NONEXISTENT')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = {
      discountValue: 30,
      usageLimit: 200,
      isActive: false,
    };

    it('should update voucher', async () => {
      const existingVoucher = {
        id: 'id',
        code: 'UPDATEME',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 20,
        version: 1,
      };

      const updatedVoucher = {
        ...existingVoucher,
        ...updateDto,
        version: 2,
      };

      mockPrismaService.voucher.findFirst.mockResolvedValue(existingVoucher);
      mockPrismaService.voucher.update.mockResolvedValue(updatedVoucher);

      const result = await service.update('UPDATEME', updateDto);

      expect(result).toEqual(updatedVoucher);
      expect(mockPrismaService.voucher.update).toHaveBeenCalledWith({
        where: { id: 'id', version: 1 },
        data: expect.objectContaining({
          ...updateDto,
          version: { increment: 1 },
        }),
      });
    });

    it('should reject code update attempts', async () => {
      const existingVoucher = {
        id: 'id',
        code: 'ORIGINAL',
        discountValue: 20,
      };

      mockPrismaService.voucher.findFirst.mockResolvedValue(existingVoucher);

      await expect(service.update('ORIGINAL', { code: 'NEWCODE' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should validate percentage discount on update', async () => {
      const existingVoucher = {
        id: 'id',
        code: 'CODE',
        discountType: DiscountType.PERCENTAGE,
      };

      mockPrismaService.voucher.findFirst.mockResolvedValue(existingVoucher);

      await expect(service.update('CODE', { discountValue: 150 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('should soft delete voucher with no usage', async () => {
      const voucher = {
        id: 'id',
        code: 'DELETE',
        currentUsage: 0,
        version: 1,
      };

      mockPrismaService.voucher.findFirst.mockResolvedValue(voucher);
      mockPrismaService.voucher.update.mockResolvedValue({
        ...voucher,
        deletedAt: new Date(),
      });

      await service.remove('DELETE');

      expect(mockPrismaService.voucher.update).toHaveBeenCalledWith({
        where: { id: 'id' },
        data: {
          deletedAt: expect.any(Date),
          isActive: false,
        },
      });
    });

    it('should reject delete for voucher with usage', async () => {
      const voucher = {
        id: 'id',
        code: 'USED',
        currentUsage: 5,
      };

      mockPrismaService.voucher.findFirst.mockResolvedValue(voucher);

      await expect(service.remove('USED')).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.voucher.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent voucher', async () => {
      mockPrismaService.voucher.findFirst.mockResolvedValue(null);

      await expect(service.remove('NONEXISTENT')).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateVoucher', () => {
    it('should validate voucher is active and not expired', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const voucher = {
        id: 'id',
        code: 'VALID',
        isActive: true,
        expirationDate: tomorrow,
        usageLimit: 100,
        currentUsage: 50,
        minOrderValue: 50,
      };

      mockPrismaService.voucher.findFirst.mockResolvedValue(voucher);

      const result = await service.validateVoucher('VALID', 100);

      expect(result).toEqual(voucher);
    });

    it('should reject inactive voucher', async () => {
      const voucher = {
        id: 'id',
        code: 'INACTIVE',
        isActive: false,
      };

      mockPrismaService.voucher.findFirst.mockResolvedValue(voucher);

      await expect(service.validateVoucher('INACTIVE', 100)).rejects.toThrow(BadRequestException);
    });

    it('should reject expired voucher', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const voucher = {
        id: 'id',
        code: 'EXPIRED',
        isActive: true,
        expirationDate: yesterday,
      };

      mockPrismaService.voucher.findFirst.mockResolvedValue(voucher);

      await expect(service.validateVoucher('EXPIRED', 100)).rejects.toThrow(BadRequestException);
    });

    it('should reject when usage limit exceeded', async () => {
      const voucher = {
        id: 'id',
        code: 'MAXED',
        isActive: true,
        expirationDate: new Date('2030-01-01'),
        usageLimit: 100,
        currentUsage: 100,
      };

      mockPrismaService.voucher.findFirst.mockResolvedValue(voucher);

      await expect(service.validateVoucher('MAXED', 100)).rejects.toThrow(BadRequestException);
    });

    it('should reject when order value below minimum', async () => {
      const voucher = {
        id: 'id',
        code: 'MINORDER',
        isActive: true,
        expirationDate: new Date('2030-01-01'),
        usageLimit: 100,
        currentUsage: 0,
        minOrderValue: 100,
      };

      mockPrismaService.voucher.findFirst.mockResolvedValue(voucher);

      await expect(service.validateVoucher('MINORDER', 50)).rejects.toThrow(BadRequestException);
    });
  });
});
