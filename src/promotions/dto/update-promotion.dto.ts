import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
  IsBoolean,
  IsPositive,
  IsArray,
  IsString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DiscountType } from '@prisma/client';
import { Type } from 'class-transformer';

export class UpdatePromotionDto {
  @ApiPropertyOptional({
    enum: DiscountType,
    description: 'Type of discount',
  })
  @IsOptional()
  @IsEnum(DiscountType)
  discountType?: DiscountType;

  @ApiPropertyOptional({
    example: 30.0,
    minimum: 0.01,
    description: 'Discount value',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  discountValue?: number;

  @ApiPropertyOptional({
    example: '2025-12-31T23:59:59Z',
    description: 'Expiration date in ISO format',
  })
  @IsOptional()
  @IsDateString()
  expirationDate?: Date;

  @ApiPropertyOptional({
    example: 200,
    minimum: 1,
    description: 'Maximum usage limit',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  usageLimit?: number;

  @ApiPropertyOptional({
    example: ['Electronics', 'Gadgets', 'Books'],
    description: 'Product categories eligible for this promotion',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eligibleCategories?: string[];

  @ApiPropertyOptional({
    example: ['PROD-001', 'PROD-002', 'PROD-003'],
    description: 'Specific product IDs eligible for this promotion',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  eligibleItems?: string[];

  @ApiPropertyOptional({
    example: false,
    description: 'Whether the promotion is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
