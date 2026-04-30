import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateProductDto {
  @ApiPropertyOptional({ example: 'SKU001' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sku?: string;

  @ApiPropertyOptional({ example: 'Produk A 500ml (Updated)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: '6fe3afec-2be1-4937-bbab-2b3bfeeb9ddd' })
  @IsOptional()
  @IsUUID()
  baseUomId?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [String], example: ['6fe3afec-2be1-4937-bbab-2b3bfeeb9ddd'] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  supplierIds?: string[];
}
