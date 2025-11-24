import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Get config service
  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 3000;

  // Enable CORS
  app.enableCors();

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Voucher and Promotion Management API')
    .setDescription(
      `
## Overview

A comprehensive REST API for managing vouchers, promotions, and applying discounts to customer orders.

## Key Features

- **Voucher Management**: Create and manage order-wide discount codes (percentage or fixed amount)
- **Promotion Management**: Create product-specific promotions targeting categories or individual items
- **Order Processing**: Apply multiple discounts with automatic validation and calculation
- **Discount Cap**: Automatic enforcement of 50% maximum discount rule
- **Optimistic Locking**: Prevent concurrent usage count issues
- **Soft Delete**: Non-destructive deletion for audit trails

## Authentication

All endpoints except \`/health\` require JWT authentication. Include the token in the Authorization header:

\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

### Getting Started

1. Register a new user via \`POST /api/v1/auth/register\`
2. Login to receive a JWT token via \`POST /api/v1/auth/login\`
3. Use the token for all subsequent requests

### Roles

- **ADMIN**: Full access to voucher and promotion management
- **CUSTOMER**: Can create orders and apply discounts

## Business Rules

### Vouchers
- Apply to entire order subtotal
- Support PERCENTAGE (0-100%) or FIXED amount discounts
- Optional minimum order value requirement
- Usage limits and expiration dates
- Case-insensitive code matching

### Promotions
- Apply only to eligible products (by category or product ID)
- Support PERCENTAGE or FIXED (per-item) discounts
- OR logic: item matches if in eligible category OR product ID list
- Usage limits and expiration dates
- Case-insensitive code matching

### Discount Application
- Maximum 50% total discount cap (cumulative across all discounts)
- Cannot apply same code twice to one order
- Can only apply to PENDING orders
- Automatic usage count tracking
- Removing discount releases usage count

## Example Workflow

1. **Admin creates voucher**: \`POST /api/v1/vouchers\` with code "SAVE20" (20% off)
2. **Customer creates order**: \`POST /api/v1/orders\` with items
3. **Customer applies voucher**: \`POST /api/v1/orders/{id}/apply-discount\` with code "SAVE20"
4. **System calculates discount**: 20% applied, respecting 50% cap
5. **Customer completes order**: Order status updated to CONFIRMED

## Error Responses

All errors follow a consistent format:

\`\`\`json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
\`\`\`

Common error codes:
- **400**: Invalid input or business rule violation
- **401**: Missing or invalid JWT token
- **403**: Insufficient permissions (role mismatch)
- **404**: Resource not found
- **409**: Conflict (e.g., duplicate discount code)

## Rate Limiting

API is rate-limited to 100 requests per minute per IP address.
      `,
    )
    .setVersion('1.0.0')
    .setContact('API Support', 'https://github.com/your-org/voucher-api', 'support@example.com')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addServer(`http://localhost:${port}/`, 'Development server')
    .addServer('https://api.example.com/', 'Production server')
    .addTag('Auth', 'User registration, login, and token management')
    .addTag('Vouchers', 'Voucher CRUD operations (Admin only) - order-wide discounts')
    .addTag('Promotions', 'Promotion CRUD operations (Admin only) - product-specific discounts')
    .addTag('Orders', 'Order creation and discount application (Customer)')
    .addTag('Health', 'System health check endpoints (Public)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Swagger documentation available at: http://localhost:${port}/api/docs`);
}

bootstrap();
