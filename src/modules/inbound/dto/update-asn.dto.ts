import { InboundAsnStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateAsnDto {
  @ApiPropertyOptional({ example: 'REF-12345' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  referenceNo?: string;

  @ApiPropertyOptional({ description: 'ISO datetime' })
  @IsOptional()
  @IsDateString()
  expectedAt?: string;

  @ApiPropertyOptional({ enum: InboundAsnStatus })
  @IsOptional()
  @IsEnum(InboundAsnStatus)
  status?: InboundAsnStatus;
}
