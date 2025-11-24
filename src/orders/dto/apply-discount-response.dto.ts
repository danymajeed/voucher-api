import { ApiProperty } from '@nestjs/swagger';

export class ApplyDiscountResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Order ID',
  })
  orderId: string;

  @ApiProperty({
    example: 'VOUCHER',
    enum: ['VOUCHER', 'PROMOTION'],
    description: 'Type of discount applied',
  })
  discountType: string;

  @ApiProperty({
    example: 'SAVE20',
    description: 'Discount code applied',
  })
  discountCode: string;

  @ApiProperty({
    example: '13.99',
    description: 'Discount amount',
  })
  discountAmount: string;

  @ApiProperty({
    example: '55.96',
    description: 'New order total after discount',
  })
  newTotal: string;

  @ApiProperty({
    example: 'Voucher SAVE20 applied successfully',
    description: 'Success message',
  })
  message: string;
}
