import { PrismaClient, UserRole, DiscountType, OrderStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data (in reverse order of dependencies)
  await prisma.orderDiscount.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.voucher.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ Cleaned existing data');

  // Create users
  const hashedPassword = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@example.com',
      password: hashedPassword,
      role: UserRole.ADMIN,
    },
  });

  const customer1 = await prisma.user.create({
    data: {
      email: 'customer1@example.com',
      password: hashedPassword,
      role: UserRole.CUSTOMER,
    },
  });

  const customer2 = await prisma.user.create({
    data: {
      email: 'customer2@example.com',
      password: hashedPassword,
      role: UserRole.CUSTOMER,
    },
  });

  console.log('✅ Created users');

  // Create vouchers
  const voucher1 = await prisma.voucher.create({
    data: {
      code: 'SAVE20',
      discountType: DiscountType.PERCENTAGE,
      discountValue: 20,
      minOrderValue: 50,
      expirationDate: new Date('2025-12-31'),
      usageLimit: 100,
      currentUsage: 0,
    },
  });

  const voucher2 = await prisma.voucher.create({
    data: {
      code: 'FLAT50',
      discountType: DiscountType.FIXED,
      discountValue: 50,
      minOrderValue: 200,
      expirationDate: new Date('2025-12-31'),
      usageLimit: 50,
      currentUsage: 0,
    },
  });

  const voucher3 = await prisma.voucher.create({
    data: {
      code: 'WELCOME10',
      discountType: DiscountType.FIXED,
      discountValue: 10,
      minOrderValue: 30,
      expirationDate: new Date('2025-12-31'),
      usageLimit: 1000,
      currentUsage: 0,
    },
  });

  console.log('✅ Created vouchers');

  // Create promotions
  const promotion1 = await prisma.promotion.create({
    data: {
      code: 'TECHSALE',
      discountType: DiscountType.PERCENTAGE,
      discountValue: 15,
      eligibleCategories: ['Electronics'],
      eligibleItems: [],
      expirationDate: new Date('2025-06-30'),
      usageLimit: 500,
      currentUsage: 0,
    },
  });

  const promotion2 = await prisma.promotion.create({
    data: {
      code: 'BOOKDEAL',
      discountType: DiscountType.FIXED,
      discountValue: 5,
      eligibleCategories: ['Books'],
      eligibleItems: [],
      expirationDate: new Date('2025-12-31'),
      usageLimit: 200,
      currentUsage: 0,
    },
  });

  const promotion3 = await prisma.promotion.create({
    data: {
      code: 'SPECIAL',
      discountType: DiscountType.PERCENTAGE,
      discountValue: 10,
      eligibleCategories: [],
      eligibleItems: ['ITEM-001', 'ITEM-002', 'ITEM-003'],
      expirationDate: new Date('2025-12-31'),
      usageLimit: 300,
      currentUsage: 0,
    },
  });

  console.log('✅ Created promotions');

  // Create sample orders
  const order1 = await prisma.order.create({
    data: {
      customerId: customer1.id,
      subtotal: 150.00,
      totalDiscount: 30.00,
      finalTotal: 120.00,
      status: OrderStatus.PENDING,
      items: {
        create: [
          {
            productId: 'LAPTOP-001',
            productName: 'Gaming Laptop',
            category: 'Electronics',
            unitPrice: 100.00,
            quantity: 1,
            lineTotal: 100.00,
          },
          {
            productId: 'MOUSE-001',
            productName: 'Wireless Mouse',
            category: 'Electronics',
            unitPrice: 25.00,
            quantity: 2,
            lineTotal: 50.00,
          },
        ],
      },
      discounts: {
        create: [
          {
            discountType: 'VOUCHER',
            discountCode: voucher1.code,
            discountAmount: 30.00,
          },
        ],
      },
    },
  });

  // Update voucher usage
  await prisma.voucher.update({
    where: { id: voucher1.id },
    data: { currentUsage: 1 },
  });

  const order2 = await prisma.order.create({
    data: {
      customerId: customer2.id,
      subtotal: 80.00,
      totalDiscount: 0,
      finalTotal: 80.00,
      status: OrderStatus.PENDING,
      items: {
        create: [
          {
            productId: 'BOOK-001',
            productName: 'TypeScript Handbook',
            category: 'Books',
            unitPrice: 30.00,
            quantity: 2,
            lineTotal: 60.00,
          },
          {
            productId: 'BOOK-002',
            productName: 'Clean Code',
            category: 'Books',
            unitPrice: 20.00,
            quantity: 1,
            lineTotal: 20.00,
          },
        ],
      },
    },
  });

  const order3 = await prisma.order.create({
    data: {
      customerId: customer1.id,
      subtotal: 250.00,
      totalDiscount: 50.00,
      finalTotal: 200.00,
      status: OrderStatus.CONFIRMED,
      items: {
        create: [
          {
            productId: 'MONITOR-001',
            productName: '4K Monitor',
            category: 'Electronics',
            unitPrice: 250.00,
            quantity: 1,
            lineTotal: 250.00,
          },
        ],
      },
      discounts: {
        create: [
          {
            discountType: 'VOUCHER',
            discountCode: voucher2.code,
            discountAmount: 50.00,
          },
        ],
      },
    },
  });

  // Update voucher usage
  await prisma.voucher.update({
    where: { id: voucher2.id },
    data: { currentUsage: 1 },
  });

  console.log('✅ Created orders');

  console.log('\n📊 Seed Summary:');
  console.log(`   👥 Users: ${await prisma.user.count()}`);
  console.log(`      - Admin: admin@example.com (password: password123)`);
  console.log(`      - Customer1: customer1@example.com (password: password123)`);
  console.log(`      - Customer2: customer2@example.com (password: password123)`);
  console.log(`   🎫 Vouchers: ${await prisma.voucher.count()}`);
  console.log(`      - SAVE20 (20% off, min $50)`);
  console.log(`      - FLAT50 ($50 off, min $200)`);
  console.log(`      - WELCOME10 ($10 off, min $30)`);
  console.log(`   🎁 Promotions: ${await prisma.promotion.count()}`);
  console.log(`      - TECHSALE (15% off Electronics)`);
  console.log(`      - BOOKDEAL ($5 off Books)`);
  console.log(`      - SPECIAL (10% off specific items)`);
  console.log(`   📦 Orders: ${await prisma.order.count()}`);
  console.log(`   📋 Order Items: ${await prisma.orderItem.count()}`);
  console.log(`   💸 Applied Discounts: ${await prisma.orderDiscount.count()}`);
  console.log('\n✨ Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
