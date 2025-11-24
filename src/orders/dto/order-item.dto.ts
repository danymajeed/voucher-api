import { IsString, IsNumber, IsPositive, Min, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @ApiProperty({
    example: 'PROD-001',
    description: 'Product ID',
  })
  @IsString()
  @MaxLength(100)
  productId: string;

  @ApiProperty({
    example: 'Wireless Mouse',
    description: 'Product name',
  })
  @IsString()
  @MaxLength(200)
  productName: string;

  @ApiProperty({
    example: 'Electronics',
    description: 'Product category',
  })
  @IsString()
  @MaxLength(100)
  category: string;

  @ApiProperty({
    example: 29.99,
    minimum: 0,
    description: 'Unit price',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  unitPrice: number;

  @ApiProperty({
    example: 2,
    minimum: 1,
    description: 'Quantity',
  })
  @IsNumber()
  @IsPositive()
  @Min(1)
  @Type(() => Number)
  quantity: number;
}
