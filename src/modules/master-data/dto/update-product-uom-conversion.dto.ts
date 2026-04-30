import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class UpdateProductUomConversionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fromUomId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  toUomId?: string;

  @ApiPropertyOptional({ example: 0.001 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001)
  factor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
