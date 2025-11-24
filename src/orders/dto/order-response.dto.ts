import { ApiProperty } from '@nestjs/swagger';
import { OrderStatus } from '@prisma/client';

export class OrderItemResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Order item ID',
  })
  id: string;

  @ApiProperty({
    example: 'PROD-001',
    description: 'Product ID',
  })
  productId: string;

  @ApiProperty({
    example: 'Wireless Mouse',
    description: 'Product name',
  })
  productName: string;

  @ApiProperty({
    example: 'Electronics',
    description: 'Product category',
  })
  category: string;

  @ApiProperty({
    example: '29.99',
    description: 'Unit price',
  })
  unitPrice: string;

  @ApiProperty({
    example: 2,
    description: 'Quantity',
  })
  quantity: number;

  @ApiProperty({
    example: '59.98',
    description: 'Line total (unitPrice * quantity)',
  })
  lineTotal: string;
}

export class OrderDiscountResponseDto {
  @ApiProperty({
    example: 'VOUCHER',
    enum: ['VOUCHER', 'PROMOTION'],
    description: 'Type of discount',
  })
  discountType: string;

  @ApiProperty({
    example: 'SAVE20',
    description: 'Discount code',
  })
  discountCode: string;

  @ApiProperty({
    example: '13.99',
    description: 'Discount amount',
  })
  discountAmount: string;

  @ApiProperty({
    example: '2025-01-01T00:00:00Z',
    description: 'When discount was applied',
  })
  appliedAt: Date;
}

export class OrderResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Order ID',
  })
  id: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'Customer ID',
  })
  customerId: string;

  @ApiProperty({
    example: '69.97',
    description: 'Subtotal before discounts',
  })
  subtotal: string;

  @ApiProperty({
    example: '13.99',
    description: 'Total discount amount',
  })
  totalDiscount: string;

  @ApiProperty({
    example: '55.98',
    description: 'Final total after discounts',
  })
  finalTotal: string;

  @ApiProperty({
    enum: OrderStatus,
    example: OrderStatus.PENDING,
    description: 'Order status',
  })
  status: OrderStatus;

  @ApiProperty({
    type: [OrderItemResponseDto],
    description: 'Order items',
  })
  items: OrderItemResponseDto[];

  @ApiProperty({
    type: [OrderDiscountResponseDto],
    description: 'Applied discounts',
  })
  discounts: OrderDiscountResponseDto[];

  @ApiProperty({
    example: '2025-01-01T00:00:00Z',
    description: 'Order creation timestamp',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2025-01-01T00:00:00Z',
    description: 'Last update timestamp',
  })
  updatedAt: Date;
}
