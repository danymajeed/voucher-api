import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVoucherDto, UpdateVoucherDto, QueryVoucherDto } from './dto';
import { Voucher, DiscountType, Prisma } from '@prisma/client';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { customAlphabet } from 'nanoid';

@Injectable()
export class VouchersService {
  // Generate 8-character codes with readable characters (exclude confusing ones)
  private readonly generateCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);

  constructor(private readonly prisma: PrismaService) {}

  async create(createVoucherDto: CreateVoucherDto): Promise<Voucher> {
    const { code, discountType, discountValue, expirationDate, ...rest } = createVoucherDto;

    // Validate percentage discount
    if (discountType === DiscountType.PERCENTAGE && discountValue > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100');
    }

    // Validate expiration date is in the future
    if (new Date(expirationDate) <= new Date()) {
      throw new BadRequestException('Expiration date must be in the future');
    }

    // Generate code if not provided
    let voucherCode = code?.toUpperCase();
    if (!voucherCode) {
      voucherCode = await this.generateUniqueCode();
    } else {
      // Check for duplicate code
      const existing = await this.prisma.voucher.findFirst({
        where: { code: voucherCode },
      });
      if (existing) {
        throw new ConflictException(`Voucher with code ${voucherCode} already exists`);
      }
    }

    return this.prisma.voucher.create({
      data: {
        code: voucherCode,
        discountType,
        discountValue,
        expirationDate: new Date(expirationDate),
        ...rest,
      },
    });
  }

  async findAll(query: QueryVoucherDto): Promise<PaginatedResult<Voucher>> {
    const { page = 1, limit = 20, isActive } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.VoucherWhereInput = {
      deletedAt: null, // Exclude soft-deleted vouchers
    };

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [data, total] = await Promise.all([
      this.prisma.voucher.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.voucher.count({ where }),
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

  async findOne(code: string): Promise<Voucher> {
    const voucher = await this.prisma.voucher.findFirst({
      where: {
        code: code.toUpperCase(),
        deletedAt: null,
      },
    });

    if (!voucher) {
      throw new NotFoundException(`Voucher with code ${code} not found`);
    }

    return voucher;
  }

  async update(code: string, updateVoucherDto: UpdateVoucherDto): Promise<Voucher> {
    const voucher = await this.findOne(code);

    // Prevent code updates
    if ('code' in updateVoucherDto) {
      throw new BadRequestException('Voucher code cannot be updated');
    }

    // Validate percentage discount if updating
    if (
      updateVoucherDto.discountValue !== undefined &&
      (updateVoucherDto.discountType === DiscountType.PERCENTAGE ||
        (updateVoucherDto.discountType === undefined &&
          voucher.discountType === DiscountType.PERCENTAGE))
    ) {
      if (updateVoucherDto.discountValue > 100) {
        throw new BadRequestException('Percentage discount cannot exceed 100');
      }
    }

    // Validate expiration date if updating
    if (
      updateVoucherDto.expirationDate &&
      new Date(updateVoucherDto.expirationDate) <= new Date()
    ) {
      throw new BadRequestException('Expiration date must be in the future');
    }

    // Update with optimistic locking using version
    try {
      return await this.prisma.voucher.update({
        where: {
          id: voucher.id,
          version: voucher.version,
        },
        data: {
          ...updateVoucherDto,
          expirationDate: updateVoucherDto.expirationDate
            ? new Date(updateVoucherDto.expirationDate)
            : undefined,
          version: { increment: 1 },
        },
      });
    } catch (error) {
      if (error.code === 'P2025') {
        throw new ConflictException('Voucher was updated by another process. Please try again.');
      }
      throw error;
    }
  }

  async remove(code: string): Promise<void> {
    const voucher = await this.findOne(code);

    // Prevent deletion if voucher has been used
    if (voucher.currentUsage > 0) {
      throw new BadRequestException('Cannot delete voucher that has been used');
    }

    // Soft delete by setting deletedAt and deactivating
    await this.prisma.voucher.update({
      where: { id: voucher.id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  async validateVoucher(code: string, orderValue: number): Promise<Voucher> {
    const voucher = await this.findOne(code);

    // Check if voucher is active
    if (!voucher.isActive) {
      throw new BadRequestException('Voucher is not active');
    }

    // Check if voucher has expired
    if (new Date(voucher.expirationDate) <= new Date()) {
      throw new BadRequestException('Voucher has expired');
    }

    // Check usage limit
    if (voucher.currentUsage >= voucher.usageLimit) {
      throw new BadRequestException('Voucher usage limit has been reached');
    }

    // Check minimum order value
    if (voucher.minOrderValue && orderValue < Number(voucher.minOrderValue)) {
      throw new BadRequestException(
        `Order value is below minimum required (${voucher.minOrderValue})`,
      );
    }

    return voucher;
  }

  async incrementUsage(id: string, version: number): Promise<Voucher> {
    try {
      return await this.prisma.voucher.update({
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
        throw new ConflictException('Voucher usage was updated by another process');
      }
      throw error;
    }
  }

  async decrementUsage(id: string): Promise<Voucher> {
    const voucher = await this.prisma.voucher.findUnique({
      where: { id },
    });

    if (!voucher) {
      throw new NotFoundException('Voucher not found');
    }

    if (voucher.currentUsage === 0) {
      return voucher; // Nothing to decrement
    }

    return await this.prisma.voucher.update({
      where: { id },
      data: {
        currentUsage: { decrement: 1 },
        version: { increment: 1 },
      },
    });
  }

  private async generateUniqueCode(attempts = 0): Promise<string> {
    if (attempts > 10) {
      throw new Error('Failed to generate unique voucher code');
    }

    const code = this.generateCode();

    // Check if code already exists
    const existing = await this.prisma.voucher.findFirst({
      where: { code },
    });

    if (existing) {
      return this.generateUniqueCode(attempts + 1);
    }

    return code;
  }
}
