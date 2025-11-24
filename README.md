# Voucher and Promotion Management API

A scalable NestJS-based REST API for managing vouchers, promotions, and applying discounts to orders with comprehensive business rules and validation.

## Features

- **Voucher Management**: Create, read, update, and delete vouchers with percentage or fixed discounts
- **Promotion Management**: Create promotions targeting specific product categories or items
- **Order Processing**: Create orders and apply vouchers/promotions with automatic discount calculation
- **Discount Cap Enforcement**: Automatic 50% maximum discount cap across all applied discounts
- **JWT Authentication**: Secure endpoints with role-based access control (Admin/Customer)
- **Comprehensive Validation**: Business rules for min order value, usage limits, expiration dates
- **Optimistic Locking**: Prevent concurrent voucher/promotion usage issues
- **Soft Delete**: Non-destructive deletion for data integrity
- **Full API Documentation**: Interactive Swagger/OpenAPI documentation

## Technology Stack

- **Runtime**: Node.js 20 LTS
- **Framework**: NestJS 10.x
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL 15+
- **ORM**: Prisma 5.x
- **Authentication**: JWT with Passport
- **Validation**: class-validator, class-transformer
- **Documentation**: Swagger/OpenAPI
- **Testing**: Jest, Supertest
- **Containerization**: Docker, Docker Compose

## Prerequisites

- Node.js 20 LTS or higher
- npm or yarn
- PostgreSQL 15+ (or Docker)
- Git

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd voucher-api
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Update the `.env` file with your configuration:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/voucher_db?schema=public"

# JWT
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
JWT_EXPIRES_IN="1h"

# Application
PORT=3000
NODE_ENV="development"

# Rate Limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=100
```

### 4. Database Setup

#### Option A: Using Docker (Recommended)

```bash
# Start PostgreSQL with Docker Compose
docker-compose up -d

# Run migrations
npm run prisma:migrate

# Seed the database with test data
npm run prisma:seed
```

#### Option B: Using Local PostgreSQL

```bash
# Ensure PostgreSQL is running
# Update DATABASE_URL in .env with your local connection string

# Run migrations
npm run prisma:migrate

# Seed the database
npm run prisma:seed
```

### 5. Run the Application

```bash
# Development mode with hot reload
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

The API will be available at `http://localhost:3000`

## API Documentation

Once the application is running, access the interactive Swagger documentation at:

```
http://localhost:3000/api/docs
```

## Default Users (After Seeding)

The seed script creates the following test users:

| Email | Password | Role | Description |
|-------|----------|------|-------------|
| admin@example.com | password123 | ADMIN | Full access to all endpoints |
| customer1@example.com | password123 | CUSTOMER | Can create orders and apply discounts |
| customer2@example.com | password123 | CUSTOMER | Can create orders and apply discounts |

## Available Scripts

```bash
# Development
npm run start:dev          # Start with hot reload
npm run start:debug        # Start in debug mode

# Build
npm run build              # Build for production

# Testing
npm test                   # Run unit tests
npm run test:watch         # Run tests in watch mode
npm run test:cov           # Run tests with coverage
npm run test:e2e           # Run end-to-end tests
npm run test:integration   # Run integration tests

# Code Quality
npm run lint               # Lint and fix code
npm run format             # Format code with Prettier

# Database
npm run prisma:generate    # Generate Prisma client
npm run prisma:migrate     # Run database migrations
npm run prisma:seed        # Seed database with test data
npm run prisma:migrate:reset # Reset database and re-run migrations
```

## API Endpoints

### Authentication

```
POST   /api/v1/auth/register     Register a new user
POST   /api/v1/auth/login        Login and receive JWT token
POST   /api/v1/auth/refresh      Refresh JWT token
```

### Vouchers (Admin Only)

```
POST   /api/v1/vouchers          Create a new voucher
GET    /api/v1/vouchers          List all vouchers (paginated)
GET    /api/v1/vouchers/:code    Get voucher by code
PATCH  /api/v1/vouchers/:code    Update voucher
DELETE /api/v1/vouchers/:code    Soft delete voucher
```

### Promotions (Admin Only)

```
POST   /api/v1/promotions        Create a new promotion
GET    /api/v1/promotions        List all promotions (paginated)
GET    /api/v1/promotions/:code  Get promotion by code
PATCH  /api/v1/promotions/:code  Update promotion
DELETE /api/v1/promotions/:code  Soft delete promotion
```

### Orders (Customer)

```
POST   /api/v1/orders                     Create a new order
GET    /api/v1/orders/:id                 Get order by ID
POST   /api/v1/orders/:id/apply-discount  Apply voucher or promotion
DELETE /api/v1/orders/:id/discounts/:code Remove discount from order
POST   /api/v1/orders/:id/cancel          Cancel order
```

### Health Check

```
GET    /health                    Health check endpoint (public)
```

## Example Usage

### 1. Register and Login

```bash
# Register a new customer
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "securepassword",
    "role": "CUSTOMER"
  }'

# Login to get JWT token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer1@example.com",
    "password": "password123"
  }'

# Save the returned JWT token
export TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### 2. Create an Order

```bash
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": "LAPTOP-001",
        "productName": "Gaming Laptop",
        "category": "Electronics",
        "unitPrice": 1000,
        "quantity": 1
      },
      {
        "productId": "MOUSE-001",
        "productName": "Wireless Mouse",
        "category": "Electronics",
        "unitPrice": 50,
        "quantity": 2
      }
    ]
  }'
```

### 3. Apply a Discount

```bash
# Apply voucher SAVE20 (20% off)
curl -X POST http://localhost:3000/api/v1/orders/{orderId}/apply-discount \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"code": "SAVE20"}'

# Response includes discount amount and new total
```

## Business Rules

### Vouchers

- **Code**: Unique, uppercase, alphanumeric
- **Types**: PERCENTAGE (0-100%) or FIXED (amount)
- **Min Order Value**: Optional minimum order requirement
- **Usage Limit**: Maximum number of times voucher can be used
- **Expiration**: Must be valid (not expired)
- **Application**: Applied to entire order subtotal

### Promotions

- **Code**: Unique, uppercase, alphanumeric
- **Types**: PERCENTAGE (0-100%) or FIXED (per-item discount)
- **Eligibility**: Must target categories OR specific product IDs
- **Usage Limit**: Maximum number of times promotion can be used
- **Expiration**: Must be valid (not expired)
- **Application**: Applied only to eligible items in order

### Discount Rules

- **Maximum Cap**: Total discounts cannot exceed 50% of order subtotal
- **No Duplicates**: Cannot apply same code twice to one order
- **Order Status**: Can only apply to PENDING orders
- **Cumulative**: Multiple discounts can be applied (up to 50% cap)
- **Removal**: Discounts can be removed from PENDING orders
- **Cancellation**: Canceling an order releases all usage counts

## Testing

The project includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:cov

# Run specific test suites
npm run test:e2e           # End-to-end API tests
npm run test:integration   # Integration tests
npm test -- vouchers       # Unit tests for vouchers
```

Current test coverage: **57 tests** across unit, integration, and e2e suites.

## Database Schema

### Key Models

- **User**: Authentication and authorization
- **Voucher**: Order-wide discounts with business rules
- **Promotion**: Product-specific discounts with eligibility
- **Order**: Customer orders with items and status
- **OrderItem**: Individual products in an order
- **OrderDiscount**: Applied discounts tracking

### Relationships

```
User ─┬─> Orders
      └─> Vouchers (createdBy)
      └─> Promotions (createdBy)

Order ─┬─> OrderItems
       └─> OrderDiscounts

Voucher ──> OrderDiscounts
Promotion ──> OrderDiscounts
```

## Docker Support

### Development with Docker Compose

```bash
# Start all services (API + PostgreSQL)
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down

# Reset everything
docker-compose down -v
```

### Production Docker Build

```bash
# Build image
docker build -t voucher-api:latest .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="..." \
  voucher-api:latest
```

## Project Structure

```
voucher-api/
├── prisma/
│   ├── migrations/         # Database migrations
│   ├── schema.prisma       # Prisma schema
│   └── seed.ts            # Database seeding script
├── src/
│   ├── auth/              # Authentication module
│   ├── common/            # Shared utilities
│   │   ├── decorators/   # Custom decorators
│   │   ├── filters/      # Exception filters
│   │   ├── guards/       # Auth guards
│   │   └── interceptors/ # Logging interceptor
│   ├── config/           # Configuration
│   ├── orders/           # Orders module
│   ├── prisma/           # Prisma service
│   ├── promotions/       # Promotions module
│   ├── vouchers/         # Vouchers module
│   ├── app.controller.ts # Health check
│   ├── app.module.ts     # Root module
│   └── main.ts           # Application entry
├── test/
│   ├── e2e/              # End-to-end tests
│   ├── integration/      # Integration tests
│   └── unit/             # Unit tests
├── .env.example          # Environment template
├── docker-compose.yml    # Docker Compose config
├── Dockerfile            # Production Docker image
└── README.md            # This file
```

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker ps

# View PostgreSQL logs
docker-compose logs postgres

# Reset database
npm run prisma:migrate:reset
```

### Port Already in Use

```bash
# Change port in .env file
PORT=3001

# Or kill process using port 3000
lsof -ti:3000 | xargs kill -9
```

### JWT Token Expired

```bash
# Use the refresh endpoint
curl -X POST http://localhost:3000/api/v1/auth/refresh \
  -H "Authorization: Bearer $TOKEN"
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- Open an issue on GitHub
- Check the API documentation at `/api/docs`
- Review the test files for usage examples

## Acknowledgments

Built with:
- [NestJS](https://nestjs.com/) - Progressive Node.js framework
- [Prisma](https://www.prisma.io/) - Next-generation ORM
- [PostgreSQL](https://www.postgresql.org/) - Open source database
- [Passport](http://www.passportjs.org/) - Authentication middleware
