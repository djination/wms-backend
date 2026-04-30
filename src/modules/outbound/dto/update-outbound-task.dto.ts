import { OutboundTaskStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateOutboundTaskDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  assignedTo?: string;

  @ApiPropertyOptional({ enum: OutboundTaskStatus })
  @IsOptional()
  @IsEnum(OutboundTaskStatus)
  status?: OutboundTaskStatus;

  @ApiPropertyOptional({ type: [String], example: ['SN-PLAN-001', 'SN-PLAN-002'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serialNos?: string[];
}
