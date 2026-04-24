import { BillingComponent } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateBillingRateDto {
  @ApiProperty()
  @IsString()
  contractId: string;

  @ApiProperty({ enum: BillingComponent })
  @IsEnum(BillingComponent)
  component: BillingComponent;

  @ApiProperty({ example: 'INBOUND_RECEIVING' })
  @IsString()
  @MaxLength(64)
  activityCode: string;

  @ApiProperty({ example: 'LINE' })
  @IsString()
  @MaxLength(30)
  uom: string;

  @ApiProperty({ example: 2500 })
  @IsNumber()
  @Min(0)
  rate: number;

  @ApiPropertyOptional({ example: 100000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minCharge?: number;
}
