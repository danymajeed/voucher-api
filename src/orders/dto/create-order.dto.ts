import { IsArray, ArrayMinSize, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { OrderItemDto } from './order-item.dto';

export class CreateOrderDto {
  @ApiProperty({
    type: [OrderItemDto],
    description: 'Array of order items',
    example: [
      {
        productId: 'PROD-001',
        productName: 'Wireless Mouse',
        category: 'Electronics',
        unitPrice: 29.99,
        quantity: 2,
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
