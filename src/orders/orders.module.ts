import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { VouchersModule } from '../vouchers/vouchers.module';
import { PromotionsModule } from '../promotions/promotions.module';

@Module({
  imports: [PrismaModule, VouchersModule, PromotionsModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
