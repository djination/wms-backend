import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ProcessGenealogyQueryDto {
  @ApiPropertyOptional({ description: 'Transformation ID (exact match)' })
  @IsOptional()
  @IsUUID()
  transformationId?: string;

  @ApiPropertyOptional({ description: 'Output lot number (exact match)', example: 'LOT-FLAV-001' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  outputLotNo?: string;

  @ApiPropertyOptional({ description: 'Output batch number (exact match)', example: 'BATCH-FLAV-001' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  outputBatchNo?: string;
}
