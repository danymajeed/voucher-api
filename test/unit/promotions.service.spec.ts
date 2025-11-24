import { Test, TestingModule } from '@nestjs/testing';
import { PromotionsService } from '../../src/promotions/promotions.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { DiscountType } from '@prisma/client';

describe('PromotionsService', () => {
  let service: PromotionsService;
  let _prismaService: PrismaService;

  const mockPrismaService = {
    promotion: {
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
        PromotionsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PromotionsService>(PromotionsService);
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
      code: 'TECHSALE',
      discountType: DiscountType.PERCENTAGE,
      discountValue: 15,
      expirationDate: tomorrow,
      usageLimit: 100,
      eligibleCategories: ['Electronics'],
      eligibleItems: [],
    };

    it('should create promotion with eligible categories', async () => {
      const mockPromotion = {
        id: 'promo-id',
        ...createDto,
        currentUsage: 0,
        isActive: true,
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockPrismaService.promotion.findFirst.mockResolvedValue(null); // No duplicate
      mockPrismaService.promotion.create.mockResolvedValue(mockPromotion);

      const result = await service.create(createDto);

      expect(result).toEqual(mockPromotion);
      expect(mockPrismaService.promotion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          code: 'TECHSALE',
          eligibleCategories: ['Electronics'],
          eligibleItems: [],
        }),
      });
    });

    it('should create promotion with eligible items', async () => {
      const dtoWithItems = {
        ...createDto,
        eligibleCategories: [],
        eligibleItems: ['PROD-001', 'PROD-002'],
      };

      const mockPromotion = {
        id: 'promo-id',
        ...dtoWithItems,
        currentUsage: 0,
        isActive: true,
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockPrismaService.promotion.findFirst.mockResolvedValue(null);
      mockPrismaService.promotion.create.mockResolvedValue(mockPromotion);

      const result = await service.create(dtoWithItems);

      expect(result.eligibleItems).toEqual(['PROD-001', 'PROD-002']);
      expect(result.eligibleCategories).toEqual([]);
    });

    it('should create promotion with both categories and items', async () => {
      const dtoWithBoth = {
        ...createDto,
        eligibleCategories: ['Electronics'],
        eligibleItems: ['PROD-999'],
      };

      const mockPromotion = {
        id: 'promo-id',
        ...dtoWithBoth,
        currentUsage: 0,
        isActive: true,
        version: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      mockPrismaService.promotion.findFirst.mockResolvedValue(null);
      mockPrismaService.promotion.create.mockResolvedValue(mockPromotion);

      const result = await service.create(dtoWithBoth);

      expect(result.eligibleCategories).toEqual(['Electronics']);
      expect(result.eligibleItems).toEqual(['PROD-999']);
    });

    it('should reject promotion with no eligibility criteria', async () => {
      const invalidDto = {
        ...createDto,
        eligibleCategories: [],
        eligibleItems: [],
      };

      await expect(service.create(invalidDto)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.promotion.create).not.toHaveBeenCalled();
    });

    it('should reject duplicate code', async () => {
      mockPrismaService.promotion.findFirst.mockResolvedValue({
        id: 'existing',
        code: 'TECHSALE',
      });

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
      expect(mockPrismaService.promotion.create).not.toHaveBeenCalled();
    });

    it('should reject percentage discount over 100', async () => {
      const invalidDto = {
        ...createDto,
        discountType: DiscountType.PERCENTAGE,
        discountValue: 150,
      };

      await expect(service.create(invalidDto)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.promotion.create).not.toHaveBeenCalled();
    });

    it('should reject past expiration date', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const invalidDto = {
        ...createDto,
        expirationDate: yesterday,
      };

      await expect(service.create(invalidDto)).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.promotion.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated promotions', async () => {
      const mockPromotions = [
        {
          id: '1',
          code: 'CODE1',
          discountValue: 10,
          eligibleCategories: ['Electronics'],
        },
        {
          id: '2',
          code: 'CODE2',
          discountValue: 20,
          eligibleCategories: ['Books'],
        },
      ];

      mockPrismaService.promotion.findMany.mockResolvedValue(mockPromotions);
      mockPrismaService.promotion.count.mockResolvedValue(2);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(mockPromotions);
      expect(result.meta).toEqual({
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should filter by active status', async () => {
      mockPrismaService.promotion.findMany.mockResolvedValue([]);
      mockPrismaService.promotion.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, isActive: true });

      expect(mockPrismaService.promotion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            deletedAt: null,
          }),
        }),
      );
    });

    it('should exclude soft-deleted promotions', async () => {
      mockPrismaService.promotion.findMany.mockResolvedValue([]);
      mockPrismaService.promotion.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10 });

      expect(mockPrismaService.promotion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should find promotion by code (case-insensitive)', async () => {
      const mockPromotion = {
        id: 'id',
        code: 'TESTCODE',
        discountValue: 25,
        eligibleCategories: ['Electronics'],
        eligibleItems: [],
      };

      mockPrismaService.promotion.findFirst.mockResolvedValue(mockPromotion);

      const result = await service.findOne('testcode');

      expect(result).toEqual(mockPromotion);
      expect(mockPrismaService.promotion.findFirst).toHaveBeenCalledWith({
        where: {
          code: 'TESTCODE',
          deletedAt: null,
        },
      });
    });

    it('should throw NotFoundException for non-existent code', async () => {
      mockPrismaService.promotion.findFirst.mockResolvedValue(null);

      await expect(service.findOne('NONEXISTENT')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = {
      discountValue: 30,
      usageLimit: 200,
      eligibleCategories: ['Electronics', 'Gadgets'],
      isActive: false,
    };

    it('should update promotion', async () => {
      const existingPromotion = {
        id: 'id',
        code: 'UPDATEME',
        discountType: DiscountType.PERCENTAGE,
        discountValue: 20,
        eligibleCategories: ['Electronics'],
        eligibleItems: [],
        version: 1,
      };

      const updatedPromotion = {
        ...existingPromotion,
        ...updateDto,
        version: 2,
      };

      mockPrismaService.promotion.findFirst.mockResolvedValue(existingPromotion);
      mockPrismaService.promotion.update.mockResolvedValue(updatedPromotion);

      const result = await service.update('UPDATEME', updateDto);

      expect(result).toEqual(updatedPromotion);
      expect(mockPrismaService.promotion.update).toHaveBeenCalledWith({
        where: { id: 'id', version: 1 },
        data: expect.objectContaining({
          ...updateDto,
          version: { increment: 1 },
        }),
      });
    });

    it('should reject code update attempts', async () => {
      const existingPromotion = {
        id: 'id',
        code: 'ORIGINAL',
        discountValue: 20,
        eligibleCategories: ['Electronics'],
        eligibleItems: [],
      };

      mockPrismaService.promotion.findFirst.mockResolvedValue(existingPromotion);

      await expect(service.update('ORIGINAL', { code: 'NEWCODE' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject update with no eligibility criteria', async () => {
      const existingPromotion = {
        id: 'id',
        code: 'CODE',
        eligibleCategories: ['Electronics'],
        eligibleItems: [],
      };

      mockPrismaService.promotion.findFirst.mockResolvedValue(existingPromotion);

      await expect(
        service.update('CODE', {
          eligibleCategories: [],
          eligibleItems: [],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate percentage discount on update', async () => {
      const existingPromotion = {
        id: 'id',
        code: 'CODE',
        discountType: DiscountType.PERCENTAGE,
        eligibleCategories: ['Electronics'],
        eligibleItems: [],
      };

      mockPrismaService.promotion.findFirst.mockResolvedValue(existingPromotion);

      await expect(service.update('CODE', { discountValue: 150 })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('remove', () => {
    it('should soft delete promotion with no usage', async () => {
      const promotion = {
        id: 'id',
        code: 'DELETE',
        currentUsage: 0,
        version: 1,
      };

      mockPrismaService.promotion.findFirst.mockResolvedValue(promotion);
      mockPrismaService.promotion.update.mockResolvedValue({
        ...promotion,
        deletedAt: new Date(),
      });

      await service.remove('DELETE');

      expect(mockPrismaService.promotion.update).toHaveBeenCalledWith({
        where: { id: 'id' },
        data: {
          deletedAt: expect.any(Date),
          isActive: false,
        },
      });
    });

    it('should reject delete for promotion with usage', async () => {
      const promotion = {
        id: 'id',
        code: 'USED',
        currentUsage: 5,
      };

      mockPrismaService.promotion.findFirst.mockResolvedValue(promotion);

      await expect(service.remove('USED')).rejects.toThrow(BadRequestException);
      expect(mockPrismaService.promotion.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException for non-existent promotion', async () => {
      mockPrismaService.promotion.findFirst.mockResolvedValue(null);

      await expect(service.remove('NONEXISTENT')).rejects.toThrow(NotFoundException);
    });
  });

  describe('validatePromotion', () => {
    it('should validate promotion is active and not expired', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const promotion = {
        id: 'id',
        code: 'VALID',
        isActive: true,
        expirationDate: tomorrow,
        usageLimit: 100,
        currentUsage: 50,
        eligibleCategories: ['Electronics'],
        eligibleItems: [],
      };

      mockPrismaService.promotion.findFirst.mockResolvedValue(promotion);

      const result = await service.validatePromotion('VALID');

      expect(result).toEqual(promotion);
    });

    it('should reject inactive promotion', async () => {
      const promotion = {
        id: 'id',
        code: 'INACTIVE',
        isActive: false,
      };

      mockPrismaService.promotion.findFirst.mockResolvedValue(promotion);

      await expect(service.validatePromotion('INACTIVE')).rejects.toThrow(BadRequestException);
    });

    it('should reject expired promotion', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const promotion = {
        id: 'id',
        code: 'EXPIRED',
        isActive: true,
        expirationDate: yesterday,
      };

      mockPrismaService.promotion.findFirst.mockResolvedValue(promotion);

      await expect(service.validatePromotion('EXPIRED')).rejects.toThrow(BadRequestException);
    });

    it('should reject when usage limit exceeded', async () => {
      const promotion = {
        id: 'id',
        code: 'MAXED',
        isActive: true,
        expirationDate: new Date('2030-01-01'),
        usageLimit: 100,
        currentUsage: 100,
      };

      mockPrismaService.promotion.findFirst.mockResolvedValue(promotion);

      await expect(service.validatePromotion('MAXED')).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkEligibility', () => {
    const orderItems = [
      {
        productId: 'PROD-001',
        productName: 'Laptop',
        category: 'Electronics',
        unitPrice: 1000,
        quantity: 1,
      },
      {
        productId: 'PROD-002',
        productName: 'Book',
        category: 'Books',
        unitPrice: 20,
        quantity: 2,
      },
    ];

    it('should match items by category', () => {
      const promotion = {
        id: 'id',
        code: 'CATPROMO',
        eligibleCategories: ['Electronics'],
        eligibleItems: [],
      } as any;

      const result = service.checkEligibility(promotion, orderItems);

      expect(result).toEqual([orderItems[0]]);
    });

    it('should match items by product ID', () => {
      const promotion = {
        id: 'id',
        code: 'ITEMPROMO',
        eligibleCategories: [],
        eligibleItems: ['PROD-002'],
      } as any;

      const result = service.checkEligibility(promotion, orderItems);

      expect(result).toEqual([orderItems[1]]);
    });

    it('should match items by either category OR item ID', () => {
      const promotion = {
        id: 'id',
        code: 'MIXEDPROMO',
        eligibleCategories: ['Books'],
        eligibleItems: ['PROD-001'],
      } as any;

      const result = service.checkEligibility(promotion, orderItems);

      expect(result).toHaveLength(2);
      expect(result).toContainEqual(orderItems[0]);
      expect(result).toContainEqual(orderItems[1]);
    });

    it('should return empty array when no items match', () => {
      const promotion = {
        id: 'id',
        code: 'NOMATCHES',
        eligibleCategories: ['Clothing'],
        eligibleItems: ['PROD-999'],
      } as any;

      const result = service.checkEligibility(promotion, orderItems);

      expect(result).toEqual([]);
    });

    it('should be case-insensitive for category matching', () => {
      const promotion = {
        id: 'id',
        code: 'CASETEST',
        eligibleCategories: ['electronics'],
        eligibleItems: [],
      } as any;

      const result = service.checkEligibility(promotion, orderItems);

      expect(result).toEqual([orderItems[0]]);
    });
  });
});
