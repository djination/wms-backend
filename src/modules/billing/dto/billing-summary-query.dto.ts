import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class BillingSummaryQueryDto {
  @ApiProperty()
  @IsString()
  customerId: string;

  @ApiProperty({ description: 'Billing period key, e.g. 2026-04' })
  @IsString()
  @MaxLength(20)
  periodKey: string;
}
