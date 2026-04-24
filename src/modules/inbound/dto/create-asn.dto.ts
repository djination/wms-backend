import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class CreateAsnItemDto {
  @ApiProperty({ example: 'eb16cdfc-8630-4c1b-9134-c47eeeb3f32f' })
  @IsUUID()
  productId!: string;

  @ApiProperty({ example: '6fe3afec-2be1-4937-bbab-2b3bfeeb9ddd' })
  @IsUUID()
  supplierId!: string;

  @ApiProperty({ example: '3a4f3120-ff3f-4c63-9df6-37830c4e4c4d' })
  @IsUUID()
  uomId!: string;

  @ApiProperty({ example: 100 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  qtyExpected!: number;
}

export class CreateAsnDto {
  @ApiProperty({ example: 'ASN-20260407-001' })
  @IsString()
  @MaxLength(80)
  asnNo!: string;

  @ApiProperty({ example: '23ef6f4f-b5d2-4ccd-a7d7-94544ff5210f' })
  @IsUUID()
  customerId!: string;

  @ApiProperty({ example: '7ef0b6cf-8443-4ad9-a66f-48b6597152f4' })
  @IsUUID()
  warehouseId!: string;

  @ApiPropertyOptional({ example: 'PO-12345' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceNo?: string;

  @ApiPropertyOptional({ example: '2026-04-08T08:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expectedAt?: string;

  @ApiProperty({ type: [CreateAsnItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateAsnItemDto)
  items!: CreateAsnItemDto[];
}
