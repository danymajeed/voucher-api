import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePromotionDto, UpdatePromotionDto, QueryPromotionDto } from './dto';
import { Promotion, DiscountType, Prisma } from '@prisma/client';
import { PaginatedResult } from '../common/dto/pagination.dto';

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPromotionDto: CreatePromotionDto): Promise<Promotion> {
    const {
      code,
      discountType,
      discountValue,
      expirationDate,
      eligibleCategories,
      eligibleItems,
      ...rest
    } = createPromotionDto;

    // Validate that at least one eligibility criterion is provided
    if (
      (!eligibleCategories || eligibleCategories.length === 0) &&
      (!eligibleItems || eligibleItems.length === 0)
    ) {
      throw new BadRequestException(
        'At least one eligibility criterion (categories or items) must be specified',
      );
    }

    // Validate percentage discount
    if (discountType === DiscountType.PERCENTAGE && discountValue > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100');
    }

    // Validate expiration date is in the future
    if (new Date(expirationDate) <= new Date()) {
      throw new BadRequestException('Expiration date must be in the future');
    }

    // Check for duplicate code
    const promotionCode = code.toUpperCase();
    const existing = await this.prisma.promotion.findFirst({
      where: { code: promotionCode },
    });
    if (existing) {
      throw new ConflictException(`Promotion with code ${promotionCode} already exists`);
    }

    return this.prisma.promotion.create({
      data: {
        code: promotionCode,
        discountType,
        discountValue,
        expirationDate: new Date(expirationDate),
        eligibleCategories: eligibleCategories || [],
        eligibleItems: eligibleItems || [],
        ...rest,
      },
    });
  }

  async findAll(query: QueryPromotionDto): Promise<PaginatedResult<Promotion>> {
    const { page = 1, limit = 20, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.PromotionWhereInput = {
      deletedAt: null, // Exclude soft-deleted promotions
    };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await Promise.all([
      this.prisma.promotion.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.promotion.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(code: string): Promise<Promotion> {
    const promotion = await this.prisma.promotion.findFirst({
      where: {
        code: code.toUpperCase(),
        deletedAt: null,
      },
    });

    if (!promotion) {
      throw new NotFoundException(`Promotion with code ${code} not found`);
    }

    return promotion;
  }

  async update(code: string, updatePromotionDto: UpdatePromotionDto): Promise<Promotion> {
    const promotion = await this.findOne(code);

    // Prevent code updates
    if ('code' in updatePromotionDto) {
      throw new BadRequestException('Promotion code cannot be updated');
    }

    // Validate that at least one eligibility criterion is provided when updating
    const newCategories =
      updatePromotionDto.eligibleCategories !== undefined
        ? updatePromotionDto.eligibleCategories
        : promotion.eligibleCategories;
    const newItems =
      updatePromotionDto.eligibleItems !== undefined
        ? updatePromotionDto.eligibleItems
        : promotion.eligibleItems;

    if (newCategories.length === 0 && newItems.length === 0) {
      throw new BadRequestException(
        'At least one eligibility criterion (categories or items) must be specified',
      );
    }

    // Validate percentage discount if updating
    if (
      updatePromotionDto.discountValue !== undefined &&
      (updatePromotionDto.discountType === DiscountType.PERCENTAGE ||
        (updatePromotionDto.discountType === undefined &&
          promotion.discountType === DiscountType.PERCENTAGE))
    ) {
      if (updatePromotionDto.discountValue > 100) {
        throw new BadRequestException('Percentage discount cannot exceed 100');
      }
    }

    // Validate expiration date if updating
    if (
      updatePromotionDto.expirationDate &&
      new Date(updatePromotionDto.expirationDate) <= new Date()
    ) {
      throw new BadRequestException('Expiration date must be in the future');
    }

    // Update with optimistic locking using version
    try {
      return await this.prisma.promotion.update({
        where: {
          id: promotion.id,
          version: promotion.version,
        },
        data: {
          ...updatePromotionDto,
          expirationDate: updatePromotionDto.expirationDate
            ? new Date(updatePromotionDto.expirationDate)
            : undefined,
          version: { increment: 1 },
        },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new ConflictException('Promotion was updated by another process. Please try again.');
      }
      throw error;
    }
  }

  async remove(code: string): Promise<void> {
    const promotion = await this.findOne(code);

    // Prevent deletion if promotion has been used
    if (promotion.currentUsage > 0) {
      throw new BadRequestException('Cannot delete promotion that has been used');
    }

    // Soft delete by setting deletedAt and deactivating
    await this.prisma.promotion.update({
      where: { id: promotion.id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  async validatePromotion(code: string): Promise<Promotion> {
    const promotion = await this.findOne(code);

    // Check if promotion is active
    if (!promotion.isActive) {
      throw new BadRequestException('Promotion is not active');
    }

    // Check if promotion has expired
    if (new Date(promotion.expirationDate) <= new Date()) {
      throw new BadRequestException('Promotion has expired');
    }

    // Check usage limit
    if (promotion.currentUsage >= promotion.usageLimit) {
      throw new BadRequestException('Promotion usage limit has been reached');
    }

    return promotion;
  }

  /**
   * Check which order items are eligible for the promotion
   * @param promotion The promotion to check eligibility for
   * @param orderItems Array of order items to check
   * @returns Array of eligible order items
   */
  checkEligibility(
    promotion: Promotion,
    orderItems: Array<{
      productId: string;
      category: string;
      [key: string]: any;
    }>,
  ): Array<any> {
    const eligibleCategories = promotion.eligibleCategories.map((cat) => cat.toLowerCase());
    const eligibleItemIds = promotion.eligibleItems;

    return orderItems.filter((item) => {
      // Check if item matches by category (case-insensitive)
      const matchesCategory =
        eligibleCategories.length > 0 && eligibleCategories.includes(item.category.toLowerCase());

      // Check if item matches by product ID
      const matchesItem = eligibleItemIds.length > 0 && eligibleItemIds.includes(item.productId);

      // Item is eligible if it matches either category OR item ID
      return matchesCategory || matchesItem;
    });
  }

  async incrementUsage(id: string, version: number): Promise<Promotion> {
    try {
      return await this.prisma.promotion.update({
        where: {
          id,
          version,
        },
        data: {
          currentUsage: { increment: 1 },
          version: { increment: 1 },
        },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new ConflictException('Promotion usage was updated by another process');
      }
      throw error;
    }
  }

  async decrementUsage(id: string): Promise<Promotion> {
    const promotion = await this.prisma.promotion.findUnique({
      where: { id },
    });

    if (!promotion) {
      throw new NotFoundException('Promotion not found');
    }

    if (promotion.currentUsage === 0) {
      return promotion; // Nothing to decrement
    }

    return await this.prisma.promotion.update({
      where: { id },
      data: {
        currentUsage: { decrement: 1 },
        version: { increment: 1 },
      },
    });
  }
}
