import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { VouchersService } from '../vouchers/vouchers.service';
import { PromotionsService } from '../promotions/promotions.service';
import { CreateOrderDto, ApplyDiscountDto } from './dto';
import { Order, OrderStatus, DiscountType, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vouchersService: VouchersService,
    private readonly promotionsService: PromotionsService,
  ) {}

  async create(customerId: string, createOrderDto: CreateOrderDto): Promise<Order> {
    const { items } = createOrderDto;

    // Calculate subtotal
    const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

    // Create order with items
    const order = await this.prisma.order.create({
      data: {
        customerId,
        subtotal: new Prisma.Decimal(subtotal.toFixed(2)),
        totalDiscount: 0,
        finalTotal: new Prisma.Decimal(subtotal.toFixed(2)),
        status: OrderStatus.PENDING,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            category: item.category,
            unitPrice: new Prisma.Decimal(item.unitPrice.toFixed(2)),
            quantity: item.quantity,
            lineTotal: new Prisma.Decimal((item.unitPrice * item.quantity).toFixed(2)),
          })),
        },
      },
      include: {
        items: true,
        discounts: true,
      },
    });

    return order;
  }

  async findOne(id: string, customerId?: string): Promise<Order> {
    const where: Prisma.OrderWhereInput = { id };
    if (customerId) {
      where.customerId = customerId;
    }

    const order = await this.prisma.order.findFirst({
      where,
      include: {
        items: true,
        discounts: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  async applyVoucher(
    orderId: string,
    customerId: string,
    applyDiscountDto: ApplyDiscountDto,
  ): Promise<Order> {
    const { code } = applyDiscountDto;

    // Get order and validate ownership
    const order = await this.findOne(orderId, customerId);

    // Validate order is in PENDING status
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Can only apply discounts to pending orders');
    }

    // Check for duplicate application
    const existingDiscount = await this.prisma.orderDiscount.findUnique({
      where: {
        orderId_discountCode: {
          orderId: order.id,
          discountCode: code.toUpperCase(),
        },
      },
    });

    if (existingDiscount) {
      throw new ConflictException(`Discount code ${code} has already been applied to this order`);
    }

    // Validate voucher
    const subtotal = Number(order.subtotal);
    const voucher = await this.vouchersService.validateVoucher(code, subtotal);

    // Calculate discount amount
    const calculatedDiscount = this.calculateVoucherDiscount(voucher, subtotal);

    // Enforce 50% discount cap
    const currentDiscount = Number(order.totalDiscount);
    const discountAmount = this.enforceDiscountCap(subtotal, currentDiscount, calculatedDiscount);

    // Create discount record and update order in a transaction
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // Create discount record
      await tx.orderDiscount.create({
        data: {
          orderId: order.id,
          discountType: 'VOUCHER',
          discountCode: voucher.code,
          discountAmount: new Prisma.Decimal(discountAmount.toFixed(2)),
        },
      });

      // Calculate new totals
      const newTotalDiscount = currentDiscount + discountAmount;
      const newFinalTotal = subtotal - newTotalDiscount;

      // Update order
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          totalDiscount: new Prisma.Decimal(newTotalDiscount.toFixed(2)),
          finalTotal: new Prisma.Decimal(newFinalTotal.toFixed(2)),
        },
        include: {
          items: true,
          discounts: true,
        },
      });

      // Increment voucher usage count
      await this.vouchersService.incrementUsage(voucher.id, voucher.version);

      return updated;
    });

    return updatedOrder;
  }

  async applyPromotion(
    orderId: string,
    customerId: string,
    applyDiscountDto: ApplyDiscountDto,
  ): Promise<Order> {
    const { code } = applyDiscountDto;

    // Get order and validate ownership
    const order = await this.findOne(orderId, customerId);

    // Validate order is in PENDING status
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Can only apply discounts to pending orders');
    }

    // Check for duplicate application
    const existingDiscount = await this.prisma.orderDiscount.findUnique({
      where: {
        orderId_discountCode: {
          orderId: order.id,
          discountCode: code.toUpperCase(),
        },
      },
    });

    if (existingDiscount) {
      throw new ConflictException(`Discount code ${code} has already been applied to this order`);
    }

    // Validate promotion
    const promotion = await this.promotionsService.validatePromotion(code);

    // Check eligible items
    const eligibleItems = this.promotionsService.checkEligibility(promotion, (order as any).items);

    if (eligibleItems.length === 0) {
      throw new BadRequestException('No items in this order are eligible for this promotion');
    }

    // Calculate discount amount for eligible items only
    const calculatedDiscount = this.calculatePromotionDiscount(promotion, eligibleItems);

    // Enforce 50% discount cap
    const subtotal = Number(order.subtotal);
    const currentDiscount = Number(order.totalDiscount);
    const discountAmount = this.enforceDiscountCap(subtotal, currentDiscount, calculatedDiscount);

    // Create discount record and update order in a transaction
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // Create discount record
      await tx.orderDiscount.create({
        data: {
          orderId: order.id,
          discountType: 'PROMOTION',
          discountCode: promotion.code,
          discountAmount: new Prisma.Decimal(discountAmount.toFixed(2)),
        },
      });

      // Calculate new totals
      const newTotalDiscount = currentDiscount + discountAmount;
      const newFinalTotal = subtotal - newTotalDiscount;

      // Update order
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          totalDiscount: new Prisma.Decimal(newTotalDiscount.toFixed(2)),
          finalTotal: new Prisma.Decimal(newFinalTotal.toFixed(2)),
        },
        include: {
          items: true,
          discounts: true,
        },
      });

      // Increment promotion usage count
      await this.promotionsService.incrementUsage(promotion.id, promotion.version);

      return updated;
    });

    return updatedOrder;
  }

  async removeDiscount(orderId: string, customerId: string, code: string): Promise<Order> {
    // Get order and validate ownership
    const order = await this.findOne(orderId, customerId);

    // Validate order is in PENDING status
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Can only remove discounts from pending orders');
    }

    // Find the discount to remove
    const discount = await this.prisma.orderDiscount.findUnique({
      where: {
        orderId_discountCode: {
          orderId: order.id,
          discountCode: code.toUpperCase(),
        },
      },
    });

    if (!discount) {
      throw new NotFoundException(`Discount code ${code} not found on this order`);
    }

    // Remove discount and update order in a transaction
    const updatedOrder = await this.prisma.$transaction(async (tx) => {
      // Delete discount record
      await tx.orderDiscount.delete({
        where: { id: discount.id },
      });

      // Recalculate totals
      const subtotal = Number(order.subtotal);
      const discountAmount = Number(discount.discountAmount);
      const currentDiscount = Number(order.totalDiscount);
      const newTotalDiscount = currentDiscount - discountAmount;
      const newFinalTotal = subtotal - newTotalDiscount;

      // Update order
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          totalDiscount: new Prisma.Decimal(newTotalDiscount.toFixed(2)),
          finalTotal: new Prisma.Decimal(newFinalTotal.toFixed(2)),
        },
        include: {
          items: true,
          discounts: true,
        },
      });

      // Decrement usage count
      if (discount.discountType === 'VOUCHER') {
        const voucher = await this.vouchersService.findOne(discount.discountCode);
        await this.vouchersService.decrementUsage(voucher.id);
      } else if (discount.discountType === 'PROMOTION') {
        const promotion = await this.promotionsService.findOne(discount.discountCode);
        await this.promotionsService.decrementUsage(promotion.id);
      }

      return updated;
    });

    return updatedOrder;
  }

  async cancelOrder(orderId: string, customerId: string): Promise<Order> {
    // Get order and validate ownership
    const order = await this.findOne(orderId, customerId);

    // Validate order can be cancelled
    if (order.status === OrderStatus.CANCELLED) {
      throw new BadRequestException('Order is already cancelled');
    }

    if (order.status === OrderStatus.CONFIRMED) {
      throw new BadRequestException('Cannot cancel confirmed orders');
    }

    // Cancel order and decrement usage counts in a transaction
    const cancelledOrder = await this.prisma.$transaction(async (tx) => {
      // Update order status
      const updated = await tx.order.update({
        where: { id: order.id },
        data: {
          status: OrderStatus.CANCELLED,
        },
        include: {
          items: true,
          discounts: true,
        },
      });

      // Decrement usage counts for all applied discounts
      for (const discount of (order as any).discounts) {
        if (discount.discountType === 'VOUCHER') {
          const voucher = await this.vouchersService.findOne(discount.discountCode);
          await this.vouchersService.decrementUsage(voucher.id);
        } else if (discount.discountType === 'PROMOTION') {
          const promotion = await this.promotionsService.findOne(discount.discountCode);
          await this.promotionsService.decrementUsage(promotion.id);
        }
      }

      return updated;
    });

    return cancelledOrder;
  }

  private calculateVoucherDiscount(
    voucher: { discountType: DiscountType; discountValue: Decimal },
    subtotal: number,
  ): number {
    const discountValue = Number(voucher.discountValue);

    if (voucher.discountType === DiscountType.PERCENTAGE) {
      return (subtotal * discountValue) / 100;
    } else {
      // FIXED discount
      return Math.min(discountValue, subtotal);
    }
  }

  /**
   * Enforce 50% maximum discount cap
   * Returns the capped discount amount
   */
  private enforceDiscountCap(
    subtotal: number,
    currentTotalDiscount: number,
    newDiscountAmount: number,
  ): number {
    const maxAllowedDiscount = subtotal * 0.5; // 50% cap
    const proposedTotalDiscount = currentTotalDiscount + newDiscountAmount;

    if (proposedTotalDiscount > maxAllowedDiscount) {
      // Cap the new discount to not exceed 50% total
      const cappedNewDiscount = maxAllowedDiscount - currentTotalDiscount;

      if (cappedNewDiscount <= 0) {
        throw new BadRequestException(
          `Cannot apply discount: Maximum discount cap of 50% has been reached. Current discount: ${currentTotalDiscount.toFixed(2)}, Order subtotal: ${subtotal.toFixed(2)}`,
        );
      }

      return cappedNewDiscount;
    }

    return newDiscountAmount;
  }

  private calculatePromotionDiscount(
    promotion: { discountType: DiscountType; discountValue: Decimal },
    eligibleItems: Array<{ unitPrice: Decimal; quantity: number }>,
  ): number {
    const discountValue = Number(promotion.discountValue);

    // Calculate total of eligible items
    const eligibleTotal = eligibleItems.reduce(
      (sum, item) => sum + Number(item.unitPrice) * item.quantity,
      0,
    );

    if (promotion.discountType === DiscountType.PERCENTAGE) {
      return (eligibleTotal * discountValue) / 100;
    } else {
      // FIXED discount applied per eligible item
      return eligibleItems.reduce((sum, item) => {
        const itemDiscount = Math.min(
          discountValue * item.quantity,
          Number(item.unitPrice) * item.quantity,
        );
        return sum + itemDiscount;
      }, 0);
    }
  }
}
