import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateProductDto {
  @ApiProperty({ example: '23ef6f4f-b5d2-4ccd-a7d7-94544ff5210f' })
  @IsUUID()
  customerId!: string;

  @ApiProperty({ example: 'SKU-001' })
  @IsString()
  @MaxLength(80)
  sku!: string;

  @ApiProperty({ example: 'Produk A 500ml' })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ type: [String], example: ['6fe3afec-2be1-4937-bbab-2b3bfeeb9ddd'] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  supplierIds?: string[];
}
