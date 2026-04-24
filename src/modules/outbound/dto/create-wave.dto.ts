import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateWaveDto {
  @ApiProperty()
  @IsUUID()
  salesOrderId!: string;

  @ApiProperty({ example: 'WAVE-20260410-001' })
  @IsString()
  @MaxLength(80)
  waveNo!: string;

  @ApiPropertyOptional({ example: '2026-04-10T09:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  plannedAt?: string;
}
