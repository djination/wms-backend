import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class UpdateWaveDto {
  @ApiPropertyOptional({ example: '2026-04-10T09:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  plannedAt?: string;
}
