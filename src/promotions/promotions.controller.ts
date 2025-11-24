import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { PromotionsService } from './promotions.service';
import {
  CreatePromotionDto,
  UpdatePromotionDto,
  PromotionResponseDto,
  QueryPromotionDto,
} from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { Promotion } from '@prisma/client';

@ApiTags('Promotions')
@Controller('api/v1/promotions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new promotion (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Promotion created successfully',
    type: PromotionResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Promotion code already exists' })
  async create(@Body() createPromotionDto: CreatePromotionDto): Promise<PromotionResponseDto> {
    const promotion = await this.promotionsService.create(createPromotionDto);
    return this.transformToResponse(promotion);
  }

  @Get()
  @ApiOperation({ summary: 'List all promotions (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'List of promotions',
  })
  async findAll(@Query() query: QueryPromotionDto): Promise<PaginatedResult<PromotionResponseDto>> {
    const result = await this.promotionsService.findAll(query);

    return {
      data: result.data.map((promotion) => this.transformToResponse(promotion)),
      meta: result.meta,
    };
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get promotion by code (Admin only)' })
  @ApiParam({
    name: 'code',
    description: 'Promotion code',
    example: 'TECHSALE',
  })
  @ApiResponse({
    status: 200,
    description: 'Promotion details',
    type: PromotionResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Promotion not found' })
  async findOne(@Param('code') code: string): Promise<PromotionResponseDto> {
    const promotion = await this.promotionsService.findOne(code);
    return this.transformToResponse(promotion);
  }

  @Patch(':code')
  @ApiOperation({ summary: 'Update promotion (Admin only)' })
  @ApiParam({
    name: 'code',
    description: 'Promotion code',
    example: 'TECHSALE',
  })
  @ApiResponse({
    status: 200,
    description: 'Promotion updated successfully',
    type: PromotionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or cannot update code',
  })
  @ApiResponse({ status: 404, description: 'Promotion not found' })
  async update(
    @Param('code') code: string,
    @Body() updatePromotionDto: UpdatePromotionDto,
  ): Promise<PromotionResponseDto> {
    const promotion = await this.promotionsService.update(code, updatePromotionDto);
    return this.transformToResponse(promotion);
  }

  @Delete(':code')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete promotion (Admin only)' })
  @ApiParam({
    name: 'code',
    description: 'Promotion code',
    example: 'TECHSALE',
  })
  @ApiResponse({ status: 204, description: 'Promotion deleted successfully' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete promotion with usage history',
  })
  @ApiResponse({ status: 404, description: 'Promotion not found' })
  async remove(@Param('code') code: string): Promise<void> {
    await this.promotionsService.remove(code);
  }

  private transformToResponse(promotion: Promotion): PromotionResponseDto {
    return {
      id: promotion.id,
      code: promotion.code,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue.toString(),
      expirationDate: promotion.expirationDate,
      usageLimit: promotion.usageLimit,
      currentUsage: promotion.currentUsage,
      eligibleCategories: promotion.eligibleCategories,
      eligibleItems: promotion.eligibleItems,
      isActive: promotion.isActive,
      createdAt: promotion.createdAt,
      updatedAt: promotion.updatedAt,
    };
  }
}
