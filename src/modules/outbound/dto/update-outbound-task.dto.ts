import { OutboundTaskStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

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
}
