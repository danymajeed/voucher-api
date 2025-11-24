import { IsString, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApplyDiscountDto {
  @ApiProperty({
    example: 'SAVE20',
    description: 'Voucher or promotion code to apply',
  })
  @IsString()
  @MaxLength(20)
  @Matches(/^[A-Z0-9]+$/i, {
    message: 'Code must contain only letters and numbers',
  })
  code: string;
}
