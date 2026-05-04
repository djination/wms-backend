import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReleaseInboundReceiptCustomsDto {
  @ApiPropertyOptional({ example: 'SPPB-2026-00123', description: 'Nomor referensi pelepasan bea cukai (opsional)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  releaseRef?: string;
}
