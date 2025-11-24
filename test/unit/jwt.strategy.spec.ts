import { Test, TestingModule } from '@nestjs/testing';
import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  describe('validate', () => {
    it('should return user when valid user found', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        role: UserRole.CUSTOMER,
        password: 'hashed',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser);

      const result = await strategy.validate({ sub: 'user-id', email: 'test@example.com' });

      expect(result).toEqual({
        id: 'user-id',
        email: 'test@example.com',
        role: 'CUSTOMER',
      });

      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-id' },
      });
    });

    it('should throw UnauthorizedException when user not found', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);

      await expect(
        strategy.validate({ sub: 'non-existent', email: 'test@example.com' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when database error occurs', async () => {
      jest.spyOn(prismaService.user, 'findUnique').mockRejectedValue(new Error('Database error'));

      await expect(
        strategy.validate({ sub: 'user-id', email: 'test@example.com' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should not include password in returned user', async () => {
      const mockUser = {
        id: 'user-id',
        email: 'test@example.com',
        role: 'ADMIN',
        password: 'hashed-password',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);

      const result = await strategy.validate({ sub: 'user-id', email: 'test@example.com' });

      expect(result).not.toHaveProperty('password');
      expect(result).toEqual({
        id: 'user-id',
        email: 'test@example.com',
        role: 'ADMIN',
      });
    });
  });
});
