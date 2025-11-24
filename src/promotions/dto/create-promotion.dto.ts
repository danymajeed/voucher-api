import {
  IsEnum,
  IsNumber,
  IsString,
  IsDateString,
  Min,
  IsPositive,
  IsArray,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DiscountType } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreatePromotionDto {
  @ApiProperty({
    example: 'TECHSALE',
    maxLength: 20,
    pattern: '^[A-Z0-9]+$',
    description: 'Promotion code (must be unique)',
  })
  @IsString()
  @MaxLength(20)
  @Matches(/^[A-Z0-9]+$/, {
    message: 'Code must contain only uppercase letters and numbers',
  })
  code: string;

  @ApiProperty({
    enum: DiscountType,
    example: DiscountType.PERCENTAGE,
    description: 'Type of discount',
  })
  @IsEnum(DiscountType)
  discountType: DiscountType;

  @ApiProperty({
    example: 15.0,
    minimum: 0.01,
    description: 'Discount value (percentage: 0-100, fixed: any positive amount)',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Type(() => Number)
  discountValue: number;

  @ApiProperty({
    example: '2025-12-31T23:59:59Z',
    description: 'Expiration date in ISO format',
  })
  @IsDateString()
  expirationDate: Date;

  @ApiProperty({
    example: 100,
    minimum: 1,
    description: 'Maximum number of times the promotion can be used',
  })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  usageLimit: number;

  @ApiProperty({
    example: ['Electronics', 'Gadgets'],
    description: 'Product categories eligible for this promotion',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  eligibleCategories: string[];

  @ApiProperty({
    example: ['PROD-001', 'PROD-002'],
    description: 'Specific product IDs eligible for this promotion',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  eligibleItems: string[];
}
