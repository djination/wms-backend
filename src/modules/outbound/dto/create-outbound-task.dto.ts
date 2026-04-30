import { OutboundTaskType } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateOutboundTaskDto {
  @ApiProperty()
  @IsUUID()
  salesOrderId!: string;

  @ApiProperty()
  @IsUUID()
  salesOrderItemId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  waveId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sourceBinId?: string;

  @ApiProperty({ enum: OutboundTaskType })
  @IsEnum(OutboundTaskType)
  taskType!: OutboundTaskType;

  @ApiProperty({ example: 5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  qtyTask!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  uomId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  assignedTo?: string;

  @ApiPropertyOptional({ type: [String], example: ['SN-PLAN-001', 'SN-PLAN-002'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serialNos?: string[];
}
