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
import { VouchersService } from './vouchers.service';
import { CreateVoucherDto, UpdateVoucherDto, VoucherResponseDto, QueryVoucherDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginatedResult } from '../common/dto/pagination.dto';
import { Voucher } from '@prisma/client';

@ApiTags('Vouchers')
@Controller('api/v1/vouchers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@ApiBearerAuth()
export class VouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new voucher (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Voucher created successfully',
    type: VoucherResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  @ApiResponse({ status: 409, description: 'Voucher code already exists' })
  async create(@Body() createVoucherDto: CreateVoucherDto): Promise<VoucherResponseDto> {
    const voucher = await this.vouchersService.create(createVoucherDto);
    return this.transformToResponse(voucher);
  }

  @Get()
  @ApiOperation({ summary: 'List all vouchers (Admin only)' })
  @ApiResponse({
    status: 200,
    description: 'List of vouchers',
  })
  async findAll(@Query() query: QueryVoucherDto): Promise<PaginatedResult<VoucherResponseDto>> {
    const result = await this.vouchersService.findAll(query);

    return {
      data: result.data.map((voucher) => this.transformToResponse(voucher)),
      meta: result.meta,
    };
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get voucher by code (Admin only)' })
  @ApiParam({ name: 'code', description: 'Voucher code', example: 'SUMMER25' })
  @ApiResponse({
    status: 200,
    description: 'Voucher details',
    type: VoucherResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Voucher not found' })
  async findOne(@Param('code') code: string): Promise<VoucherResponseDto> {
    const voucher = await this.vouchersService.findOne(code);
    return this.transformToResponse(voucher);
  }

  @Patch(':code')
  @ApiOperation({ summary: 'Update voucher (Admin only)' })
  @ApiParam({ name: 'code', description: 'Voucher code', example: 'SUMMER25' })
  @ApiResponse({
    status: 200,
    description: 'Voucher updated successfully',
    type: VoucherResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input or cannot update code' })
  @ApiResponse({ status: 404, description: 'Voucher not found' })
  async update(
    @Param('code') code: string,
    @Body() updateVoucherDto: UpdateVoucherDto,
  ): Promise<VoucherResponseDto> {
    const voucher = await this.vouchersService.update(code, updateVoucherDto);
    return this.transformToResponse(voucher);
  }

  @Delete(':code')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete voucher (Admin only)' })
  @ApiParam({ name: 'code', description: 'Voucher code', example: 'SUMMER25' })
  @ApiResponse({ status: 204, description: 'Voucher deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete voucher with usage history' })
  @ApiResponse({ status: 404, description: 'Voucher not found' })
  async remove(@Param('code') code: string): Promise<void> {
    await this.vouchersService.remove(code);
  }

  private transformToResponse(voucher: Voucher): VoucherResponseDto {
    return {
      id: voucher.id,
      code: voucher.code,
      discountType: voucher.discountType,
      discountValue: voucher.discountValue.toString(),
      expirationDate: voucher.expirationDate,
      usageLimit: voucher.usageLimit,
      currentUsage: voucher.currentUsage,
      minOrderValue: voucher.minOrderValue ? voucher.minOrderValue.toString() : null,
      isActive: voucher.isActive,
      createdAt: voucher.createdAt,
      updatedAt: voucher.updatedAt,
    };
  }
}
