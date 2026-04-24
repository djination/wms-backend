import { BillingComponent, BillingTransactionStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBillingTransactionDto {
  @ApiProperty()
  @IsString()
  customerId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  warehouseId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  operatorCompanyId?: string;

  @ApiProperty({ enum: BillingComponent })
  @IsEnum(BillingComponent)
  component: BillingComponent;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  activityCode: string;

  @ApiProperty()
  @IsString()
  @MaxLength(30)
  uom: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  qty: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'Billing period key, e.g. 2026-04' })
  @IsString()
  @MaxLength(20)
  periodKey: string;

  @ApiPropertyOptional({ enum: BillingTransactionStatus, default: BillingTransactionStatus.DRAFT })
  @IsOptional()
  @IsEnum(BillingTransactionStatus)
  status?: BillingTransactionStatus;

  @ApiProperty({ description: 'ISO datetime when activity happened' })
  @IsDateString()
  occurredAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  referenceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
