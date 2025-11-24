import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiscountType } from '@prisma/client';

export class VoucherResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Unique identifier',
  })
  id: string;

  @ApiProperty({
    example: 'SUMMER25',
    description: 'Voucher code',
  })
  code: string;

  @ApiProperty({
    enum: DiscountType,
    example: DiscountType.PERCENTAGE,
    description: 'Type of discount',
  })
  discountType: DiscountType;

  @ApiProperty({
    example: '20.00',
    description: 'Discount value as string to preserve precision',
  })
  discountValue: string;

  @ApiProperty({
    example: '2025-12-31T23:59:59Z',
    description: 'Expiration date',
  })
  expirationDate: Date;

  @ApiProperty({
    example: 100,
    description: 'Maximum usage limit',
  })
  usageLimit: number;

  @ApiProperty({
    example: 0,
    description: 'Current usage count',
  })
  currentUsage: number;

  @ApiPropertyOptional({
    example: '50.00',
    description: 'Minimum order value as string',
    nullable: true,
  })
  minOrderValue: string | null;

  @ApiProperty({
    example: true,
    description: 'Whether the voucher is active',
  })
  isActive: boolean;

  @ApiProperty({
    example: '2025-01-01T00:00:00Z',
    description: 'Creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2025-01-01T00:00:00Z',
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}
