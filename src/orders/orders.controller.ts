import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import {
  CreateOrderDto,
  ApplyDiscountDto,
  ApplyDiscountResponseDto,
  OrderResponseDto,
} from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Order, OrderItem, OrderDiscount } from '@prisma/client';

type OrderWithRelations = Order & {
  items: OrderItem[];
  discounts: OrderDiscount[];
};

@ApiTags('Orders')
@Controller('api/v1/orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order' })
  @ApiResponse({
    status: 201,
    description: 'Order created successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() createOrderDto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    const order = (await this.ordersService.create(userId, createOrderDto)) as OrderWithRelations;
    return this.transformToResponse(order);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiParam({
    name: 'id',
    description: 'Order ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Order details',
    type: OrderResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findOne(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<OrderResponseDto> {
    const order = (await this.ordersService.findOne(id, userId)) as OrderWithRelations;
    return this.transformToResponse(order);
  }

  @Post(':id/apply-discount')
  @ApiOperation({ summary: 'Apply voucher or promotion to order' })
  @ApiParam({
    name: 'id',
    description: 'Order ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Discount applied successfully',
    type: ApplyDiscountResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid discount code or order not eligible' })
  @ApiResponse({ status: 404, description: 'Order or discount code not found' })
  @ApiResponse({ status: 409, description: 'Discount already applied' })
  async applyDiscount(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() applyDiscountDto: ApplyDiscountDto,
  ): Promise<ApplyDiscountResponseDto> {
    const { code } = applyDiscountDto;

    // Try to apply as voucher first
    let order: OrderWithRelations;
    let discountType: 'VOUCHER' | 'PROMOTION';

    try {
      order = (await this.ordersService.applyVoucher(
        id,
        userId,
        applyDiscountDto,
      )) as OrderWithRelations;
      discountType = 'VOUCHER';
    } catch (voucherError) {
      // If voucher fails, try as promotion
      try {
        order = (await this.ordersService.applyPromotion(
          id,
          userId,
          applyDiscountDto,
        )) as OrderWithRelations;
        discountType = 'PROMOTION';
      } catch (promotionError) {
        // If both fail, throw the voucher error (more likely to be user-facing)
        throw voucherError;
      }
    }

    // Find the discount that was just applied
    const appliedDiscount = order.discounts.find((d) => d.discountCode === code.toUpperCase());

    if (!appliedDiscount) {
      throw new Error('Applied discount not found');
    }

    return {
      orderId: order.id,
      discountType,
      discountCode: code.toUpperCase(),
      discountAmount: appliedDiscount.discountAmount.toString(),
      newTotal: order.finalTotal.toString(),
      message: `${discountType === 'VOUCHER' ? 'Voucher' : 'Promotion'} ${code.toUpperCase()} applied successfully`,
    };
  }

  @Delete(':id/discounts/:code')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove discount from order' })
  @ApiParam({
    name: 'id',
    description: 'Order ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiParam({
    name: 'code',
    description: 'Discount code to remove',
    example: 'SAVE20',
  })
  @ApiResponse({ status: 204, description: 'Discount removed successfully' })
  @ApiResponse({ status: 400, description: 'Cannot remove discount from this order' })
  @ApiResponse({ status: 404, description: 'Order or discount not found' })
  async removeDiscount(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Param('code') code: string,
  ): Promise<void> {
    await this.ordersService.removeDiscount(id, userId, code);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel an order' })
  @ApiParam({
    name: 'id',
    description: 'Order ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Order cancelled successfully',
    type: OrderResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Cannot cancel this order' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async cancelOrder(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
  ): Promise<OrderResponseDto> {
    const order = (await this.ordersService.cancelOrder(id, userId)) as OrderWithRelations;
    return this.transformToResponse(order);
  }

  private transformToResponse(order: OrderWithRelations): OrderResponseDto {
    return {
      id: order.id,
      customerId: order.customerId,
      subtotal: order.subtotal.toString(),
      totalDiscount: order.totalDiscount.toString(),
      finalTotal: order.finalTotal.toString(),
      status: order.status,
      items: order.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        category: item.category,
        unitPrice: item.unitPrice.toString(),
        quantity: item.quantity,
        lineTotal: item.lineTotal.toString(),
      })),
      discounts: order.discounts.map((discount) => ({
        discountType: discount.discountType,
        discountCode: discount.discountCode,
        discountAmount: discount.discountAmount.toString(),
        appliedAt: discount.appliedAt,
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
