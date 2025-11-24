import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
  IsBoolean,
  IsPositive,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DiscountType } from '@prisma/client';
import { Type } from 'class-transformer';

export class UpdateVoucherDto {
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
    example: 75.0,
    minimum: 0,
    description: 'Minimum order value',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  minOrderValue?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'Whether the voucher is active',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
