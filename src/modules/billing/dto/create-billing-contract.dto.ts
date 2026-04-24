import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateBillingContractDto {
  @ApiProperty()
  @IsString()
  customerId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  contractNo: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  name: string;

  @ApiProperty({ description: 'ISO date string, e.g. 2026-01-01' })
  @IsDateString()
  periodStart: string;

  @ApiPropertyOptional({ description: 'ISO date string, nullable for open-ended contract' })
  @IsOptional()
  @IsDateString()
  periodEnd?: string;

  @ApiPropertyOptional({ default: 'IDR' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  billingCycleDay?: number;
}
