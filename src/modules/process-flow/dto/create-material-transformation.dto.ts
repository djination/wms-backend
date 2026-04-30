import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

class MaterialTransformationInputDto {
  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiProperty()
  @IsUUID()
  binId!: string;

  @ApiPropertyOptional({ example: 'LOT-RAW-001' })
  @IsOptional()
  @IsString()
  lotNo?: string;

  @ApiPropertyOptional({ example: 'BATCH-RAW-001' })
  @IsOptional()
  @IsString()
  batchNo?: string;

  @ApiPropertyOptional({ type: [String], example: ['SN-RAW-001', 'SN-RAW-002'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  serialNos?: string[];

  @ApiProperty({ example: 3.5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  qtyConsumed!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  uomId?: string;
}

export class CreateMaterialTransformationDto {
  @ApiProperty()
  @IsString()
  processNo!: string;

  @ApiProperty()
  @IsUUID()
  customerId!: string;

  @ApiProperty()
  @IsUUID()
  warehouseId!: string;

  @ApiProperty()
  @IsUUID()
  outputProductId!: string;

  @ApiProperty()
  @IsUUID()
  outputBinId!: string;

  @ApiPropertyOptional({ example: 'LOT-FLAV-001' })
  @IsOptional()
  @IsString()
  outputLotNo?: string;

  @ApiPropertyOptional({ example: 'BATCH-FLAV-001' })
  @IsOptional()
  @IsString()
  outputBatchNo?: string;

  @ApiPropertyOptional({ type: [String], example: ['SN-OUT-001', 'SN-OUT-002'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  outputSerialNos?: string[];

  @ApiProperty({ example: 1.25 })
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  qtyOutput!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  outputUomId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ type: [MaterialTransformationInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MaterialTransformationInputDto)
  inputs!: MaterialTransformationInputDto[];
}
